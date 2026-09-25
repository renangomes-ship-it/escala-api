import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escala } from '../escala/entities/escala.entity';
import { FilaEscolha } from '../fila-escolha/entities/fila-escolha.entity';
import { Oficial } from '../oficial/entities/oficial.entity';
import { Permuta } from '../permuta/entities/permuta.entity';
import { Servico } from '../servico/entities/servico.entity';

type CorEscala = 'PRETA' | 'ROXA' | 'VERMELHA';

export interface ContagemCores {
  PRETA: number;
  ROXA: number;
  VERMELHA: number;
}

export interface OficialResumo {
  id: number;
  nome: string;
  postoGraduacao: string;
}

export interface LinhaDistribuicao {
  oficial: OficialResumo;
  posicao: number | null;
  statusFila: string | null;
  apto: boolean;
  cotas: ContagemCores;
  titular: ContagemCores;
  sobreaviso: ContagemCores;
  situacao: 'INAPTO' | 'CUMPRIDA' | 'PENDENTE';
}

@Injectable()
export class RelatorioService {
  constructor(
    @InjectRepository(Escala)
    private readonly escalaRepository: Repository<Escala>,
    @InjectRepository(Permuta)
    private readonly permutaRepository: Repository<Permuta>,
  ) {}

  async gerarEscala(id: number, obm?: string) {
    const escala = await this.escalaRepository.findOne({
      where: { id, ...(obm ? { obm } : {}) },
      relations: {
        servicos: { oficial_dia: true, oficial_sobreaviso: true },
        fila_escolhas: { oficial: true },
      },
    });
    if (!escala) throw new NotFoundException('Escala não encontrada.');

    const permutas = await this.permutaRepository.find({
      where: { servico: { escala: { id: escala.id } } },
      relations: {
        servico: { escala: true },
        oficial_sainte: true,
        oficial_entrante: true,
      },
      order: { data_solicitacao: 'DESC', id: 'DESC' },
    });

    const servicos = [...(escala.servicos ?? [])].sort((a, b) =>
      a.data_servico.localeCompare(b.data_servico),
    );
    const fila = [...(escala.fila_escolhas ?? [])].sort(
      (a, b) => a.posicao - b.posicao,
    );
    const distribuicao = this.montarDistribuicao(fila, servicos);
    const inaptos = fila
      .filter((item) => Boolean(item.justificativa_inaptidao))
      .map((item) => ({
        oficial: this.resumirOficialObrigatorio(item.oficial),
        justificativa: item.justificativa_inaptidao,
      }));

    return {
      escala: {
        id: escala.id,
        mes: escala.mes,
        ano: escala.ano,
        obm: escala.obm,
        status: escala.status,
        boletimInterno: escala.boletim_interno,
      },
      resumo: this.montarResumo(servicos, distribuicao, permutas),
      servicos: servicos.map((servico) => ({
        id: servico.id,
        data: servico.data_servico,
        cor: servico.tipo_escala,
        titular: this.resumirOficial(servico.oficial_dia),
        sobreaviso: this.resumirOficial(servico.oficial_sobreaviso),
      })),
      distribuicao,
      inaptos,
      permutas: permutas.map((permuta) => ({
        id: permuta.id,
        dataSolicitacao: permuta.data_solicitacao,
        dataServico: permuta.servico.data_servico,
        tipoVaga: permuta.tipo_vaga,
        status: permuta.status,
        criadoPor: permuta.criado_por,
        sainte: this.resumirOficial(permuta.oficial_sainte),
        entrante: this.resumirOficial(permuta.oficial_entrante),
        boletimInterno: permuta.boletim_interno,
        grupoTroca: permuta.grupo_troca,
        ehContrapartida: permuta.eh_contrapartida,
      })),
    };
  }

  private montarResumo(
    servicos: Servico[],
    distribuicao: LinhaDistribuicao[],
    permutas: Permuta[],
  ) {
    const porCor = {
      PRETA: { dias: 0, titulares: 0, sobreavisos: 0 },
      ROXA: { dias: 0, titulares: 0, sobreavisos: 0 },
      VERMELHA: { dias: 0, titulares: 0, sobreavisos: 0 },
    };
    for (const servico of servicos) {
      const cor = this.corValida(servico.tipo_escala);
      porCor[cor].dias += 1;
      if (servico.oficial_dia) porCor[cor].titulares += 1;
      if (servico.oficial_sobreaviso) porCor[cor].sobreavisos += 1;
    }
    return {
      totalDias: servicos.length,
      vagasPreenchidas: servicos.reduce(
        (total, item) =>
          total +
          Number(Boolean(item.oficial_dia)) +
          Number(Boolean(item.oficial_sobreaviso)),
        0,
      ),
      vagasEmAberto: servicos.reduce(
        (total, item) =>
          total + Number(!item.oficial_dia) + Number(!item.oficial_sobreaviso),
        0,
      ),
      oficiaisAptos: distribuicao.filter((item) => item.apto).length,
      oficiaisInaptos: distribuicao.filter((item) => !item.apto).length,
      cotasCumpridas: distribuicao.filter(
        (item) => item.situacao === 'CUMPRIDA',
      ).length,
      permutas: permutas.length,
      porCor,
    };
  }

  private montarDistribuicao(fila: FilaEscolha[], servicos: Servico[]) {
    const linhas = new Map<number, LinhaDistribuicao>();
    for (const turno of fila) {
      const apto = !turno.justificativa_inaptidao;
      linhas.set(turno.oficial.id, {
        oficial: this.resumirOficialObrigatorio(turno.oficial),
        posicao: turno.posicao,
        statusFila: turno.status,
        apto,
        cotas: {
          PRETA: turno.cota_preta,
          ROXA: turno.cota_roxa,
          VERMELHA: turno.cota_vermelha,
        },
        titular: this.zerarCores(),
        sobreaviso: this.zerarCores(),
        situacao: apto ? 'PENDENTE' : 'INAPTO',
      });
    }

    for (const servico of servicos) {
      const cor = this.corValida(servico.tipo_escala);
      if (servico.oficial_dia) {
        this.obterOuCriarLinha(linhas, servico.oficial_dia).titular[cor] += 1;
      }
      if (servico.oficial_sobreaviso) {
        this.obterOuCriarLinha(linhas, servico.oficial_sobreaviso).sobreaviso[
          cor
        ] += 1;
      }
    }

    for (const linha of linhas.values()) {
      if (!linha.apto) continue;
      linha.situacao = (['PRETA', 'ROXA', 'VERMELHA'] as CorEscala[]).every(
        (cor) =>
          linha.titular[cor] === linha.cotas[cor] &&
          linha.sobreaviso[cor] === linha.cotas[cor],
      )
        ? 'CUMPRIDA'
        : 'PENDENTE';
    }
    return [...linhas.values()].sort(
      (a, b) =>
        (a.posicao ?? Number.MAX_SAFE_INTEGER) -
          (b.posicao ?? Number.MAX_SAFE_INTEGER) ||
        a.oficial.nome.localeCompare(b.oficial.nome),
    );
  }

  private obterOuCriarLinha(
    linhas: Map<number, LinhaDistribuicao>,
    oficial: Oficial,
  ) {
    const existente = linhas.get(oficial.id);
    if (existente) return existente;
    const linha: LinhaDistribuicao = {
      oficial: this.resumirOficialObrigatorio(oficial),
      posicao: null,
      statusFila: null,
      apto: true,
      cotas: this.zerarCores(),
      titular: this.zerarCores(),
      sobreaviso: this.zerarCores(),
      situacao: 'PENDENTE',
    };
    linhas.set(oficial.id, linha);
    return linha;
  }

  private resumirOficial(oficial?: Oficial | null) {
    return oficial
      ? {
          id: oficial.id,
          nome: oficial.nome,
          postoGraduacao: oficial.posto_graduacao,
        }
      : null;
  }

  private resumirOficialObrigatorio(oficial: Oficial): OficialResumo {
    return {
      id: oficial.id,
      nome: oficial.nome,
      postoGraduacao: oficial.posto_graduacao,
    };
  }

  private zerarCores(): ContagemCores {
    return { PRETA: 0, ROXA: 0, VERMELHA: 0 };
  }

  private corValida(cor: string): CorEscala {
    return cor === 'ROXA' || cor === 'VERMELHA' ? cor : 'PRETA';
  }
}
