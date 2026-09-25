import { FilaEscolhaController } from './fila-escolha.controller';

describe('FilaEscolhaController', () => {
  it('encaminha os dados de uma vaga ao serviço', async () => {
    const service = { registrarEscolhaVaga: jest.fn().mockResolvedValue({}) };
    const controller = new FilaEscolhaController(service as never);
    const body = { escalaId: 1, servicoId: 3, tipoVaga: 'DIA' as const };

    await controller.registrarVaga(body, {
      id: 2,
      rg: '123',
      posto: 'Capitão',
      obm: 'OBM de Teste',
      role: 'OFICIAL',
    });

    expect(service.registrarEscolhaVaga).toHaveBeenCalledWith(
      1,
      2,
      3,
      'DIA',
      'OBM de Teste',
    );
  });

  it('remove a justificativa de inaptidão da consulta feita por oficial', async () => {
    const service = {
      obterFilaPorEscala: jest.fn().mockResolvedValue({
        progresso: [
          {
            id: 4,
            observacao: 'INAPTO',
            justificativa_inaptidao: 'Motivo reservado à gestão',
          },
        ],
      }),
    };
    const controller = new FilaEscolhaController(service as never);

    const resultado = await controller.obterStatus('1', {
      id: 2,
      rg: '123',
      posto: 'Capitão',
      obm: 'OBM de Teste',
      role: 'OFICIAL',
    });

    expect(resultado.progresso[0]).not.toHaveProperty('justificativa_inaptidao');
  });
});
