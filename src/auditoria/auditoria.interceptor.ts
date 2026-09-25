import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, mergeMap } from 'rxjs';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditoriaService, RegistrarAuditoria } from './auditoria.service';

type RequisicaoAutenticada = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditoriaInterceptor.name);

  constructor(private readonly auditoriaService: AuditoriaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    const caminho = request.originalUrl.split('?')[0];
    if (
      !request.user ||
      !['POST', 'PATCH', 'DELETE'].includes(request.method) ||
      caminho === '/auth/validate-password'
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap(async (resultado: unknown) => {
        const evento = this.criarEvento(request, resultado);
        try {
          await this.auditoriaService.registrar(evento);
        } catch (error) {
          this.logger.error(
            'Não foi possível registrar um evento de auditoria.',
            error,
          );
        }
        return resultado;
      }),
    );
  }

  private criarEvento(
    request: RequisicaoAutenticada,
    resultado: unknown,
  ): RegistrarAuditoria {
    const user = request.user!;
    const caminho = request.originalUrl.split('?')[0];
    const corpo = this.comoRegistro(request.body);
    const resposta = this.comoRegistro(resultado);
    const classificacao = this.classificar(request.method, caminho, corpo);
    const unidade =
      user.obm ??
      this.texto(this.comoRegistro(corpo.escala).obm) ??
      this.texto(corpo.obm) ??
      this.texto(resposta.obm) ??
      this.texto(
        this.comoRegistro(this.comoRegistro(resposta.servico).escala).obm,
      );
    const id =
      request.params?.id ??
      request.params?.escalaId ??
      this.texto(resposta.id) ??
      this.texto(corpo.servicoId) ??
      null;

    return {
      atorId: user.id,
      atorNome: user.nome || `Usuário ${user.id}`,
      atorRole: user.role,
      atorObm: user.obm,
      unidade,
      acao: classificacao.acao,
      recurso: classificacao.recurso,
      recursoId: id ? String(id) : null,
      descricao: classificacao.descricao,
      detalhes: this.detalhesSeguros(caminho, corpo),
    };
  }

  private classificar(
    method: string,
    caminho: string,
    corpo: Record<string, unknown>,
  ) {
    if (caminho === '/auth/alterar-senha')
      return {
        acao: 'ALTEROU_PROPRIA_SENHA',
        recurso: 'AUTENTICACAO',
        descricao: 'Alterou a própria senha.',
      };
    if (method === 'POST' && caminho === '/oficial')
      return {
        acao: 'CADASTROU_USUARIO',
        recurso: 'USUARIO',
        descricao: 'Cadastrou um usuário.',
      };
    if (method === 'PATCH' && /^\/oficial\/\d+$/.test(caminho)) {
      if ('senha' in corpo)
        return {
          acao: 'REDEFINIU_SENHA',
          recurso: 'USUARIO',
          descricao: 'Definiu uma senha temporária para um usuário.',
        };
      if ('ativo' in corpo)
        return {
          acao: corpo.ativo ? 'REATIVOU_USUARIO' : 'INATIVOU_USUARIO',
          recurso: 'USUARIO',
          descricao: corpo.ativo
            ? 'Reativou um usuário.'
            : 'Inativou um usuário.',
        };
      if ('obm' in corpo)
        return {
          acao: 'TRANSFERIU_USUARIO',
          recurso: 'USUARIO',
          descricao: 'Alterou a unidade de um usuário.',
        };
      if ('role' in corpo)
        return {
          acao: 'ALTEROU_PERFIL',
          recurso: 'USUARIO',
          descricao: 'Alterou o perfil de acesso de um usuário.',
        };
      return {
        acao: 'ATUALIZOU_USUARIO',
        recurso: 'USUARIO',
        descricao: 'Atualizou os dados de um usuário.',
      };
    }
    if (method === 'DELETE' && caminho.startsWith('/oficial/'))
      return {
        acao: 'INATIVOU_USUARIO',
        recurso: 'USUARIO',
        descricao: 'Inativou um usuário.',
      };
    if (caminho === '/escala/preparar')
      return {
        acao: 'PREPAROU_ESCALA',
        recurso: 'ESCALA',
        descricao: 'Preparou a escala e iniciou a fila de escolhas.',
      };
    if (method === 'PATCH' && caminho.startsWith('/escala/'))
      return {
        acao: 'ALTEROU_ESCALA',
        recurso: 'ESCALA',
        descricao: 'Alterou uma escala.',
      };
    if (method === 'DELETE' && caminho.startsWith('/escala/'))
      return {
        acao: 'EXCLUIU_ESCALA',
        recurso: 'ESCALA',
        descricao: 'Excluiu uma escala ainda não arquivada.',
      };
    if (caminho.includes('/passar-turno/'))
      return {
        acao: 'PASSOU_TURNO',
        recurso: 'FILA',
        descricao: 'Passou manualmente um turno da fila.',
      };
    if (caminho.includes('/finalizar-manualmente'))
      return {
        acao: 'FINALIZOU_ESCOLHA_MANUAL',
        recurso: 'FILA',
        descricao: 'Concluiu manualmente a escolha de um oficial.',
      };
    if (caminho.includes('/reivindicar/'))
      return {
        acao: 'REIVINDICOU_TURNO',
        recurso: 'FILA',
        descricao: 'Reivindicou um turno de escolha.',
      };
    if (caminho.includes('/registrar-vaga'))
      return {
        acao: 'REGISTROU_ESCOLHA',
        recurso: 'FILA',
        descricao: 'Registrou uma escolha de serviço.',
      };
    if (caminho.includes('/remover-vaga'))
      return {
        acao: 'REMOVEU_ESCOLHA',
        recurso: 'FILA',
        descricao: 'Removeu uma escolha de serviço.',
      };
    if (caminho.includes('/finalizar'))
      return {
        acao: 'FINALIZOU_ESCOLHA',
        recurso: 'FILA',
        descricao: 'Finalizou um turno de escolha.',
      };
    if (caminho.startsWith('/permuta/'))
      return this.classificarPermuta(method, caminho);
    if (method === 'PATCH' && caminho.startsWith('/unidade/'))
      return {
        acao: corpo.ativo ? 'REATIVOU_UNIDADE' : 'INATIVOU_UNIDADE',
        recurso: 'UNIDADE',
        descricao: corpo.ativo
          ? 'Reativou uma unidade.'
          : 'Inativou uma unidade.',
      };
    if (caminho.startsWith('/servico/'))
      return {
        acao: `${method}_SERVICO`,
        recurso: 'SERVICO',
        descricao: 'Alterou diretamente um serviço da escala.',
      };
    return {
      acao: `${method}_OPERACAO`,
      recurso: 'SISTEMA',
      descricao: 'Executou uma operação no sistema.',
    };
  }

  private classificarPermuta(method: string, caminho: string) {
    if (caminho.endsWith('/solicitar'))
      return {
        acao: 'SOLICITOU_PERMUTA',
        recurso: 'PERMUTA',
        descricao: 'Solicitou uma permuta.',
      };
    if (caminho.endsWith('/ajustar-escolha'))
      return {
        acao: 'AJUSTOU_ESCOLHA',
        recurso: 'PERMUTA',
        descricao: 'Trocou uma escolha por vaga livre.',
      };
    if (caminho.endsWith('/administrativa'))
      return {
        acao: 'REALIZOU_TROCA_ADMINISTRATIVA',
        recurso: 'PERMUTA',
        descricao: 'Realizou uma troca administrativa.',
      };
    if (caminho.endsWith('/responder-oficial'))
      return {
        acao: 'RESPONDEU_PERMUTA',
        recurso: 'PERMUTA',
        descricao: 'Respondeu a uma solicitação de permuta.',
      };
    if (/\/permuta\/\d+\/responder$/.test(caminho))
      return {
        acao: 'HOMOLOGOU_PERMUTA',
        recurso: 'PERMUTA',
        descricao: 'Decidiu sobre a homologação de uma permuta.',
      };
    if (caminho.endsWith('/publicar'))
      return {
        acao: 'PUBLICOU_PERMUTAS',
        recurso: 'PERMUTA',
        descricao: 'Publicou permutas em boletim.',
      };
    return {
      acao: `${method}_PERMUTA`,
      recurso: 'PERMUTA',
      descricao: 'Alterou uma permuta.',
    };
  }

  private detalhesSeguros(caminho: string, corpo: Record<string, unknown>) {
    if (/^\/oficial\/\d+$/.test(caminho)) {
      return {
        campos: Object.keys(corpo).map((campo) =>
          campo === 'senha' ? 'senha_temporaria' : campo,
        ),
      };
    }
    if (caminho === '/escala/preparar') {
      const escala = this.comoRegistro(corpo.escala);
      return { mes: escala.mes, ano: escala.ano };
    }
    if (caminho.startsWith('/permuta/') && typeof corpo.acao === 'string') {
      return { decisao: corpo.acao };
    }
    if (caminho.startsWith('/unidade/') && typeof corpo.ativo === 'boolean') {
      return { ativo: corpo.ativo };
    }
    return null;
  }

  private comoRegistro(valor: unknown): Record<string, unknown> {
    return valor && typeof valor === 'object' && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : {};
  }

  private texto(valor: unknown): string | null {
    return typeof valor === 'string' || typeof valor === 'number'
      ? String(valor)
      : null;
  }
}
