import { ServicoController } from './servico.controller';

describe('ServicoController', () => {
  it('converte o identificador antes de encaminhar a busca', () => {
    const service = { findOne: jest.fn() };
    const controller = new ServicoController(service as never);

    controller.findOne('7', {
      id: 1,
      rg: '1',
      posto: 'CAP',
      obm: 'OBM de Teste',
      role: 'ESCALANTE',
    } as never);

    expect(service.findOne).toHaveBeenCalledWith(7, 'OBM de Teste', false);
  });
});
