import { BadRequestException } from '@nestjs/common';
import { UnidadeService } from './unidade.service';

describe('UnidadeService', () => {
  it('entrega somente unidades ativas para formulários comuns', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) };
    const service = new UnidadeService(repository as never);

    await service.findAll(false);

    expect(repository.find).toHaveBeenCalledWith({
      where: { ativo: true },
      order: { id: 'ASC' },
    });
  });

  it('recusa uma unidade inexistente ou inativa', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new UnidadeService(repository as never);

    await expect(service.validarAtiva('UNIDADE INVÁLIDA')).rejects.toThrow(BadRequestException);
  });
});
