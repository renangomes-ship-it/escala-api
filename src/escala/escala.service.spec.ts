import { EscalaService } from './escala.service';
import { BadRequestException } from '@nestjs/common';

describe('EscalaService', () => {
  it('recusa encerramento quando ainda há escolha pendente', async () => {
    const repository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 4, status: 'ABERTA' })
        .mockResolvedValueOnce({
          id: 4,
          fila_escolhas: [{ status: 'ESCOLHENDO' }],
        }),
      update: jest.fn(),
    };
    const service = new EscalaService(repository as never);
    await expect(service.update(4, { status: 'FECHADA' })).rejects.toThrow(
      'Conclua a escolha de todos os oficiais',
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('libera encerramento quando todos os oficiais finalizaram', async () => {
    const repository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 4, status: 'ABERTA' })
        .mockResolvedValueOnce({
          id: 4,
          fila_escolhas: [{ status: 'FINALIZADO' }],
        })
        .mockResolvedValueOnce({ id: 4, status: 'FECHADA' }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new EscalaService(repository as never);
    await expect(
      service.update(4, { status: 'FECHADA' }),
    ).resolves.toMatchObject({ status: 'FECHADA' });
    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it('cria um serviço para cada dia quando a escala não recebe serviços', async () => {
    const repository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const service = new EscalaService(repository as never);

    const escala = await service.create({
      mes: 2,
      ano: 2024,
      obm: 'OBM de Teste',
    });

    expect(escala.servicos).toHaveLength(29);
    expect(escala.servicos[0].data_servico).toBe('2024-02-01');
    expect(escala.servicos[28].data_servico).toBe('2024-02-29');
  });

  it('preserva as cores enviadas pelo calendário do setup', async () => {
    const repository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const service = new EscalaService(repository as never);

    const escala = await service.create({
      mes: 2,
      ano: 2024,
      obm: 'OBM de Teste',
      servicos: Array.from({ length: 29 }, (_, indice) => ({
        data_servico: `2024-02-${String(indice + 1).padStart(2, '0')}`,
        tipo_escala: indice === 0 ? 'VERMELHA' : 'PRETA',
      })),
    });

    expect(escala.servicos[0]).toEqual({
      data_servico: '2024-02-01',
      tipo_escala: 'VERMELHA',
    });
  });

  it('não permite alterar uma escala arquivada', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({ id: 4, status: 'ARQUIVADA' }),
      update: jest.fn(),
    };
    const service = new EscalaService(repository as never);

    await expect(
      service.update(4, { status: 'ABERTA' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('oculta escalas arquivadas das consultas comuns', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) };
    const service = new EscalaService(repository as never);

    await service.findAll(undefined, undefined, 'OBM de Teste');

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          obm: 'OBM de Teste',
          status: expect.anything(),
        }),
      }),
    );
  });
});
