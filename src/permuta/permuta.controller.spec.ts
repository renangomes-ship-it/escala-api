import { PermutaController } from './permuta.controller';

describe('PermutaController', () => {
  const oficial = {
    id: 7,
    rg: '123',
    posto: 'Capitão',
    obm: 'OBM de Teste',
    role: 'OFICIAL' as never,
  };

  it('usa o oficial autenticado como entrante da permuta', () => {
    const service = { solicitarPermuta: jest.fn() };
    const controller = new PermutaController(service as never);

    controller.solicitar(
      { servicoId: 3, tipoVaga: 'DIA' },
      oficial,
    );

    expect(service.solicitarPermuta).toHaveBeenCalledWith(
      { servicoId: 3, tipoVaga: 'DIA', entranteId: 7 },
      'OBM de Teste',
    );
  });

  it('não aceita que o cliente determine quem respondeu a permuta', () => {
    const service = { responderPermuta: jest.fn() };
    const controller = new PermutaController(service as never);
    const escalante = { ...oficial, role: 'ESCALANTE' as never };

    controller.responder(
      '4',
      { acao: 'SIM', justificativa: 'Aprovada pela escala.' },
      escalante,
    );

    expect(service.responderPermuta).toHaveBeenCalledWith(
      4,
      'SIM',
      'ESCALANTE',
      'Aprovada pela escala.',
      'OBM de Teste',
    );
  });

  it('usa o oficial autenticado ao responder a própria solicitação recebida', () => {
    const service = { responderComoOficial: jest.fn() };
    const controller = new PermutaController(service as never);

    controller.responderComoOficial('4', { acao: 'SIM' }, oficial);

    expect(service.responderComoOficial).toHaveBeenCalledWith(
      4,
      7,
      'SIM',
      undefined,
      'OBM de Teste',
    );
  });
});
