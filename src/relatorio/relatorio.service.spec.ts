import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Escala } from '../escala/entities/escala.entity';
import { StatusFila } from '../fila-escolha/entities/fila-escolha.entity';
import { Role } from '../oficial/entities/oficial.entity';
import { Permuta } from '../permuta/entities/permuta.entity';
import { RelatorioService } from './relatorio.service';

describe('RelatorioService', () => {
  const oficialApto = {
    id: 10,
    nome: 'Oficial Apto',
    posto_graduacao: 'CAP BM',
    role: Role.OFICIAL,
  };
  const oficialInapto = {
    id: 11,
    nome: 'Oficial Inapto',
    posto_graduacao: '1º TEN BM',
    role: Role.OFICIAL,
  };
  const findOne = jest.fn();
  const findPermutas = jest.fn();
  const service = new RelatorioService(
    { findOne } as unknown as Repository<Escala>,
    { find: findPermutas } as unknown as Repository<Permuta>,
  );

  beforeEach(() => {
    findOne.mockReset();
    findPermutas.mockReset().mockResolvedValue([]);
  });

  it('consolida vagas, cotas e inaptidões da escala', async () => {
    findOne.mockResolvedValue({
      id: 1,
      mes: 9,
      ano: 2026,
      obm: 'QCG',
      status: 'PUBLICADA',
      boletim_interno: '100/2026',
      servicos: [
        {
          id: 1,
          data_servico: '2026-09-01',
          tipo_escala: 'PRETA',
          oficial_dia: oficialApto,
          oficial_sobreaviso: null,
        },
        {
          id: 2,
          data_servico: '2026-09-02',
          tipo_escala: 'PRETA',
          oficial_dia: null,
          oficial_sobreaviso: oficialApto,
        },
      ],
      fila_escolhas: [
        {
          id: 1,
          oficial: oficialApto,
          posicao: 1,
          status: StatusFila.FINALIZADO,
          cota_preta: 1,
          cota_roxa: 0,
          cota_vermelha: 0,
          justificativa_inaptidao: null,
        },
        {
          id: 2,
          oficial: oficialInapto,
          posicao: 2,
          status: StatusFila.FINALIZADO,
          cota_preta: 0,
          cota_roxa: 0,
          cota_vermelha: 0,
          justificativa_inaptidao: 'Dispensa no período.',
        },
      ],
    });

    const resultado = await service.gerarEscala(1, 'QCG');

    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, obm: 'QCG' } }),
    );
    expect(resultado.resumo).toEqual(
      expect.objectContaining({
        totalDias: 2,
        vagasPreenchidas: 2,
        vagasEmAberto: 2,
        oficiaisAptos: 1,
        oficiaisInaptos: 1,
        cotasCumpridas: 1,
      }),
    );
    expect(resultado.distribuicao[0]).toEqual(
      expect.objectContaining({ situacao: 'CUMPRIDA' }),
    );
    expect(resultado.inaptos).toEqual([
      expect.objectContaining({ justificativa: 'Dispensa no período.' }),
    ]);
  });

  it('não encontra uma escala fora do recorte de unidade', async () => {
    findOne.mockResolvedValue(null);

    await expect(service.gerarEscala(99, 'QCG')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findPermutas).not.toHaveBeenCalled();
  });
});
