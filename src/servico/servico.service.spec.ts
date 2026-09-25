import { BadRequestException } from '@nestjs/common';
import { ServicoService } from './servico.service';

describe('ServicoService', () => {
  it('impede que o mesmo oficial ocupe as duas funções no mesmo serviço', async () => {
    const service = new ServicoService({} as never, {} as never);

    await expect(
      service.create({
        data_servico: '2026-09-01',
        escala_id: 1,
        oficial_dia_id: 5,
        oficial_sobreaviso_id: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não permite editar serviço de escala arquivada', async () => {
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        escala: { id: 2, status: 'ARQUIVADA' },
      }),
      save: jest.fn(),
    };
    const service = new ServicoService(servicoRepository as never, {} as never);

    await expect(
      service.update(7, { tipo_escala: 'ROXA' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(servicoRepository.save).not.toHaveBeenCalled();
  });
});
