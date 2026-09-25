import { Role } from '../oficial/entities/oficial.entity';
import { AuditoriaController } from './auditoria.controller';
import type { AuditoriaService } from './auditoria.service';

describe('AuditoriaController', () => {
  const listar = jest.fn();
  const controller = new AuditoriaController({
    listar,
  } as unknown as AuditoriaService);

  beforeEach(() => listar.mockReset().mockResolvedValue([]));

  it('obriga o comandante a consultar somente a própria unidade', async () => {
    await controller.listar(
      { id: 1, role: Role.ADMINISTRADOR, obm: 'QCG' },
      '1º GBM',
    );

    expect(listar).toHaveBeenCalledWith(
      'QCG',
      expect.objectContaining({ unidade: '1º GBM' }),
    );
  });

  it('permite ao Master aplicar um filtro de unidade', async () => {
    await controller.listar(
      { id: 2, role: Role.ADMIN_MASTER, obm: null },
      '1º GBM',
    );

    expect(listar).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ unidade: '1º GBM' }),
    );
  });
});
