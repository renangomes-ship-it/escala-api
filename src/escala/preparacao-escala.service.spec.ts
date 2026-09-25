import { BadRequestException } from '@nestjs/common';
import { Escala } from './entities/escala.entity';
import { Oficial } from '../oficial/entities/oficial.entity';
import { PreparacaoEscalaService } from './preparacao-escala.service';

const dtoValido = {
  escala: {
    mes: 10,
    ano: 2026,
    obm: 'OBM enviada',
    servicos: [{ data_servico: '2026-10-01', tipo_escala: 'PRETA' as const }],
  },
  dadosFila: [
    {
      oficialId: 2,
      apto: true,
      cotas: { pretas: 1, roxas: 0, vermelhas: 0 },
    },
  ],
};

function criarManager() {
  const escalaRepository = { findOne: jest.fn().mockResolvedValue(null) };
  const oficialRepository = { find: jest.fn().mockResolvedValue([{ id: 2 }]) };
  const manager = {
    getRepository: jest.fn((entidade) => {
      if (entidade === Escala) return escalaRepository;
      if (entidade === Oficial) return oficialRepository;
      throw new Error('Repositório inesperado no teste.');
    }),
  };
  return { manager, escalaRepository, oficialRepository };
}

type CallbackTransacao = (
  manager: ReturnType<typeof criarManager>['manager'],
) => Promise<unknown>;

describe('PreparacaoEscalaService', () => {
  it('cria escala e fila dentro da mesma transação', async () => {
    const { manager } = criarManager();
    const dataSource = {
      transaction: jest.fn((callback: CallbackTransacao) => callback(manager)),
    };
    const escalaService = {
      create: jest.fn().mockResolvedValue({ id: 12 }),
    };
    const filaEscolhaService = {
      gerarFila: jest.fn().mockResolvedValue({ mensagem: 'Fila criada.' }),
    };
    const service = new PreparacaoEscalaService(
      dataSource as never,
      escalaService as never,
      filaEscolhaService as never,
    );

    await expect(service.preparar(dtoValido, 'QCG')).resolves.toEqual({
      id: 12,
      mensagem: 'Escala, serviços e fila criados com sucesso.',
    });
    expect(escalaService.create).toHaveBeenCalledWith(
      expect.objectContaining({ obm: 'QCG' }),
      manager,
    );
    expect(filaEscolhaService.gerarFila).toHaveBeenCalledWith(
      12,
      dtoValido.dadosFila,
      'QCG',
      manager,
    );
  });

  it('propaga a falha da fila para que a transação seja revertida', async () => {
    const { manager } = criarManager();
    const registrosConfirmados: number[] = [];
    const dataSource = {
      transaction: jest.fn(async (callback: CallbackTransacao) => {
        const estadoAnterior = [...registrosConfirmados];
        try {
          return await callback(manager);
        } catch (error) {
          registrosConfirmados.splice(
            0,
            registrosConfirmados.length,
            ...estadoAnterior,
          );
          throw error;
        }
      }),
    };
    const escalaService = {
      create: jest.fn().mockImplementation(() => {
        registrosConfirmados.push(12);
        return { id: 12 };
      }),
    };
    const filaEscolhaService = {
      gerarFila: jest
        .fn()
        .mockRejectedValue(new BadRequestException('Cotas inválidas.')),
    };
    const service = new PreparacaoEscalaService(
      dataSource as never,
      escalaService as never,
      filaEscolhaService as never,
    );

    await expect(service.preparar(dtoValido, 'QCG')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(registrosConfirmados).toEqual([]);
  });

  it('recusa oficial inativo ou pertencente a outra unidade antes de criar a escala', async () => {
    const { manager, oficialRepository } = criarManager();
    oficialRepository.find.mockResolvedValue([]);
    const dataSource = {
      transaction: jest.fn((callback: CallbackTransacao) => callback(manager)),
    };
    const escalaService = { create: jest.fn() };
    const filaEscolhaService = { gerarFila: jest.fn() };
    const service = new PreparacaoEscalaService(
      dataSource as never,
      escalaService as never,
      filaEscolhaService as never,
    );

    await expect(service.preparar(dtoValido, 'QCG')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(escalaService.create).not.toHaveBeenCalled();
  });
});
