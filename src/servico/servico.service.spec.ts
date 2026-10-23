import { BadRequestException } from '@nestjs/common';
import { ServicoService } from './servico.service';

describe('ServicoService', () => {
  it('impede que o mesmo oficial ocupe as duas funções no mesmo serviço', async () => {
    const service = new ServicoService({} as never, {} as never, {} as never);

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
    const service = new ServicoService(
      servicoRepository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update(7, { tipo_escala: 'ROXA' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(servicoRepository.save).not.toHaveBeenCalled();
  });

  it('não permite alterar a cor enquanto a escolha estiver em andamento', async () => {
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        tipo_escala: 'PRETA',
        escala: { id: 2, status: 'ABERTA' },
        oficial_dia: { id: 3 },
        oficial_sobreaviso: { id: 4 },
      }),
      save: jest.fn(),
    };
    const service = new ServicoService(
      servicoRepository as never,
      {} as never,
      {} as never,
    );

    await expect(service.update(7, { tipo_escala: 'ROXA' })).rejects.toThrow(
      'A cor dos dias só pode ser alterada depois que a escolha for encerrada.',
    );
    expect(servicoRepository.save).not.toHaveBeenCalled();
  });

  it('permite alterar a cor depois que a escolha foi encerrada', async () => {
    const servico = {
      id: 7,
      tipo_escala: 'PRETA',
      escala: { id: 2, status: 'FECHADA' },
      oficial_dia: null,
      oficial_sobreaviso: null,
    };
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue(servico),
      save: jest.fn().mockResolvedValue(servico),
    };
    const service = new ServicoService(
      servicoRepository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update(7, { tipo_escala: 'ROXA' }),
    ).resolves.toMatchObject({ tipo_escala: 'ROXA' });
    expect(servicoRepository.save).toHaveBeenCalledTimes(1);
  });

  it('impede alterar oficiais pela rota genérica de serviço', async () => {
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        tipo_escala: 'PRETA',
        escala: { id: 2, status: 'FECHADA' },
        oficial_dia: { id: 3 },
        oficial_sobreaviso: { id: 4 },
      }),
      save: jest.fn(),
    };
    const service = new ServicoService(
      servicoRepository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update(7, { oficial_sobreaviso_id: 3 }),
    ).rejects.toThrow('fluxo administrativo da grade');
    expect(servicoRepository.save).not.toHaveBeenCalled();
    expect(servicoRepository.findOne).not.toHaveBeenCalled();
  });

  it('impede criar serviço para oficial inapto na escala', async () => {
    const servicoRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const escalaRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 2, status: 'ABERTA' }),
    };
    const filaRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ observacao: 'INAPTO' })
        .mockResolvedValueOnce({ observacao: null }),
    };
    const service = new ServicoService(
      servicoRepository as never,
      escalaRepository as never,
      filaRepository as never,
    );

    await expect(
      service.create({
        data_servico: '2026-09-01',
        escala_id: 2,
        oficial_dia_id: 5,
        oficial_sobreaviso_id: 6,
      }),
    ).rejects.toThrow('declarado inapto para esta escala');
    expect(servicoRepository.save).not.toHaveBeenCalled();
  });
});
