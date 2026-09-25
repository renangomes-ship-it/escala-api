import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriaEvento } from './entities/auditoria-evento.entity';

export interface RegistrarAuditoria {
  atorId: number | null;
  atorNome: string;
  atorRole: string;
  atorObm: string | null;
  unidade: string | null;
  acao: string;
  recurso: string;
  recursoId: string | null;
  descricao: string;
  detalhes?: Record<string, unknown> | null;
}

export interface FiltrosAuditoria {
  unidade?: string;
  acao?: string;
  inicio?: string;
  fim?: string;
  limite?: number;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(AuditoriaEvento)
    private readonly repository: Repository<AuditoriaEvento>,
  ) {}

  async registrar(dados: RegistrarAuditoria): Promise<void> {
    await this.repository.save(
      this.repository.create({
        ator_id: dados.atorId,
        ator_nome: dados.atorNome,
        ator_role: dados.atorRole,
        ator_obm: dados.atorObm,
        unidade: dados.unidade,
        acao: dados.acao,
        recurso: dados.recurso,
        recurso_id: dados.recursoId,
        descricao: dados.descricao,
        detalhes: dados.detalhes ?? null,
      }),
    );
  }

  async listar(escopoObm: string | undefined, filtros: FiltrosAuditoria) {
    const limiteSolicitado = Number(filtros.limite ?? 100);
    const limite = Number.isFinite(limiteSolicitado)
      ? Math.min(Math.max(limiteSolicitado, 1), 200)
      : 100;
    const query = this.repository
      .createQueryBuilder('evento')
      .orderBy('evento.criado_em', 'DESC')
      .addOrderBy('evento.id', 'DESC')
      .take(limite);

    const unidade = escopoObm ?? filtros.unidade;
    if (unidade) query.andWhere('evento.unidade = :unidade', { unidade });
    if (filtros.acao)
      query.andWhere('evento.acao = :acao', { acao: filtros.acao });
    if (this.dataValida(filtros.inicio)) {
      query.andWhere('evento.criado_em >= :inicio', {
        inicio: `${filtros.inicio} 00:00:00`,
      });
    }
    if (this.dataValida(filtros.fim)) {
      query.andWhere('evento.criado_em <= :fim', {
        fim: `${filtros.fim} 23:59:59`,
      });
    }
    return query.getMany();
  }

  private dataValida(data?: string): data is string {
    return Boolean(data && /^\d{4}-\d{2}-\d{2}$/.test(data));
  }
}
