import { EscalaController } from './escala.controller';

describe('EscalaController', () => {
  it('converte filtros numéricos antes de consultar as escalas', async () => {
    const service = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new EscalaController(service as never, {} as never, {} as never);

    await controller.findAll('9', '2026', 'OBM ignorada', {
      id: 1,
      rg: '123',
      posto: 'Capitão',
      obm: 'OBM de Teste',
      role: 'OFICIAL',
    });

    expect(service.findAll).toHaveBeenCalledWith(9, 2026, 'OBM de Teste', false);
  });

  it('permite que o administrador consulte escalas arquivadas apenas da própria OBM', async () => {
    const service = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new EscalaController(service as never, {} as never, {} as never);

    await controller.findAll(undefined, undefined, undefined, {
      id: 1,
      rg: '123',
      posto: 'Coronel',
      obm: 'OBM de Teste',
      role: 'ADMINISTRADOR',
    });

    expect(service.findAll).toHaveBeenCalledWith(undefined, undefined, 'OBM de Teste', true);
  });

  it('permite que o administrador master consulte todas as unidades', async () => {
    const service = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new EscalaController(service as never, {} as never, {} as never);

    await controller.findAll(undefined, undefined, undefined, {
      id: 1,
      rg: '123',
      posto: 'Coronel',
      obm: null,
      role: 'ADMIN_MASTER' as never,
    });

    expect(service.findAll).toHaveBeenCalledWith(undefined, undefined, undefined, true);
  });

  it('oculta do oficial as justificativas de inaptidão', async () => {
    const service = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 1,
          fila_escolhas: [
            {
              id: 3,
              observacao: 'INAPTO',
              justificativa_inaptidao: 'Motivo reservado à gestão',
            },
          ],
        },
      ]),
    };
    const controller = new EscalaController(service as never, {} as never, {} as never);

    const resultado = await controller.findAll(undefined, undefined, undefined, {
      id: 1,
      rg: '123',
      posto: 'Capitão',
      obm: 'OBM de Teste',
      role: 'OFICIAL',
    });

    expect(resultado[0]?.fila_escolhas?.[0]).not.toHaveProperty(
      'justificativa_inaptidao',
    );
  });

  it('usa a OBM autenticada do escalante na preparação completa', async () => {
    const unidadeService = { validarAtiva: jest.fn() };
    const preparacaoService = { preparar: jest.fn().mockResolvedValue({ id: 8 }) };
    const controller = new EscalaController(
      {} as never,
      unidadeService as never,
      preparacaoService as never,
    );
    const dto = {
      escala: {
        mes: 10,
        ano: 2026,
        obm: 'Outra unidade',
        servicos: [
          { data_servico: '2026-10-01', tipo_escala: 'PRETA' as const },
        ],
      },
      dadosFila: [
        {
          oficialId: 4,
          apto: true,
          cotas: { pretas: 1, roxas: 0, vermelhas: 0 },
        },
      ],
    };

    await controller.preparar(dto, {
      id: 3,
      rg: '123',
      posto: 'Major',
      obm: 'QCG',
      role: 'ESCALANTE',
    });

    expect(unidadeService.validarAtiva).toHaveBeenCalledWith('QCG');
    expect(preparacaoService.preparar).toHaveBeenCalledWith(dto, 'QCG');
  });
});
