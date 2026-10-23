import { BadRequestException } from '@nestjs/common';
import { PermutaService } from './permuta.service';
import { Permuta } from './entities/permuta.entity';
import { Servico } from '../servico/entities/servico.entity';

describe('PermutaService', () => {
  it('não permite criar permuta em escala arquivada', async () => {
    const permutaRepository = { create: jest.fn(), save: jest.fn() };
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        escala: { id: 1, obm: 'OBM de Teste', status: 'ARQUIVADA' },
        oficial_dia: { id: 8 },
        oficial_sobreaviso: null,
      }),
    };
    const service = new PermutaService(
      permutaRepository as never,
      servicoRepository as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
    );

    await expect(
      service.solicitarPermuta(
        { servicoId: 2, tipoVaga: 'DIA', entranteId: 9 },
        'OBM de Teste',
      ),
    ).rejects.toThrow('Serviço não encontrado.');
    expect(permutaRepository.save).not.toHaveBeenCalled();
  });

  it('impede alteração administrativa que acumule as duas funções no mesmo dia', async () => {
    const permutaRepository = { create: jest.fn(), save: jest.fn() };
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        escala: { obm: 'OBM de Teste' },
        oficial_dia: null,
        oficial_sobreaviso: { id: 9 },
      }),
      save: jest.fn(),
    };
    const service = new PermutaService(
      permutaRepository as never,
      servicoRepository as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
    );

    await expect(
      service.trocaAdministrativa(
        { servicoId: 2, tipoVaga: 'DIA', sainteId: null, entranteId: 9 },
        'OBM de Teste',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(servicoRepository.save).not.toHaveBeenCalled();
  });

  it('impede adicionar serviço além da cota de quem já finalizou a escolha', async () => {
    const permutaRepository = { create: jest.fn(), save: jest.fn() };
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        tipo_escala: 'PRETA',
        escala: { id: 1, obm: 'OBM de Teste', status: 'ABERTA' },
        oficial_dia: null,
        oficial_sobreaviso: null,
      }),
      count: jest.fn().mockResolvedValue(2),
      save: jest.fn(),
    };
    const filaRepository = {
      findOne: jest.fn().mockResolvedValue({
        status: 'FINALIZADO',
        cota_preta: 2,
        cota_roxa: 0,
        cota_vermelha: 0,
      }),
    };
    const service = new PermutaService(
      permutaRepository as never,
      servicoRepository as never,
      filaRepository as never,
    );

    await expect(
      service.trocaAdministrativa(
        { servicoId: 2, tipoVaga: 'DIA', sainteId: null, entranteId: 9 },
        'OBM de Teste',
      ),
    ).rejects.toThrow('Este oficial já concluiu a cota desta cor e função.');
    expect(servicoRepository.save).not.toHaveBeenCalled();
  });

  it('impede atribuir serviço a oficial inapto mesmo após o encerramento', async () => {
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        tipo_escala: 'PRETA',
        escala: { id: 1, obm: 'OBM de Teste', status: 'FECHADA' },
        oficial_dia: null,
        oficial_sobreaviso: null,
      }),
      save: jest.fn(),
    };
    const filaRepository = {
      findOne: jest.fn().mockResolvedValue({
        status: 'FINALIZADO',
        observacao: 'INAPTO',
        cota_preta: 0,
        cota_roxa: 0,
        cota_vermelha: 0,
      }),
    };
    const service = new PermutaService(
      { create: jest.fn(), save: jest.fn() } as never,
      servicoRepository as never,
      filaRepository as never,
    );

    await expect(
      service.trocaAdministrativa(
        {
          servicoId: 2,
          tipoVaga: 'DIA',
          sainteId: null,
          entranteId: 9,
          justificativa: 'Necessidade operacional.',
        },
        'OBM de Teste',
      ),
    ).rejects.toThrow('foi declarado inapto para esta escala');
    expect(servicoRepository.save).not.toHaveBeenCalled();
  });

  it('permite remover um excesso já existente da cota finalizada', async () => {
    const servico = {
      id: 2,
      tipo_escala: 'PRETA',
      escala: { id: 1, obm: 'OBM de Teste', status: 'ABERTA' },
      oficial_dia: { id: 9 },
      oficial_sobreaviso: null,
    };
    const manager = {
      save: jest.fn(),
      transaction: jest.fn(async (executar) => executar(manager)),
    };
    const permutaRepository = {
      create: jest.fn((registro) => ({ ...registro })),
    };
    const servicoRepository = {
      manager,
      findOne: jest.fn().mockResolvedValue(servico),
      count: jest.fn().mockResolvedValue(3),
    };
    const filaRepository = {
      findOne: jest.fn().mockResolvedValue({
        status: 'FINALIZADO',
        cota_preta: 2,
        cota_roxa: 0,
        cota_vermelha: 0,
      }),
    };
    const service = new PermutaService(
      permutaRepository as never,
      servicoRepository as never,
      filaRepository as never,
    );

    await expect(
      service.trocaAdministrativa(
        { servicoId: 2, tipoVaga: 'DIA', sainteId: 9, entranteId: null },
        'OBM de Teste',
      ),
    ).resolves.toEqual(
      expect.objectContaining({ mensagem: expect.stringContaining('sucesso') }),
    );
    expect(servico.oficial_dia).toBeNull();
    expect(manager.transaction).toHaveBeenCalledTimes(1);
  });

  it('realoca serviço de oficial finalizado sem alterar sua cota', async () => {
    const origem = {
      id: 10,
      tipo_escala: 'PRETA',
      escala: { id: 1, obm: 'OBM de Teste', status: 'ABERTA' },
      oficial_dia: { id: 9 },
      oficial_sobreaviso: null,
    };
    const destino = {
      id: 11,
      tipo_escala: 'PRETA',
      escala: { id: 1, obm: 'OBM de Teste', status: 'ABERTA' },
      oficial_dia: null,
      oficial_sobreaviso: null,
    };
    const manager = {
      save: jest.fn(),
      transaction: jest.fn(async (executar) => executar(manager)),
    };
    const permutaRepository = {
      create: jest.fn((registro) => ({ ...registro })),
    };
    const servicoRepository = {
      manager,
      findOne: jest
        .fn()
        .mockResolvedValueOnce(origem)
        .mockResolvedValueOnce(destino),
      count: jest.fn().mockResolvedValue(2),
    };
    const filaRepository = {
      findOne: jest.fn().mockResolvedValue({
        status: 'FINALIZADO',
        cota_preta: 2,
        cota_roxa: 0,
        cota_vermelha: 0,
      }),
    };
    const service = new PermutaService(
      permutaRepository as never,
      servicoRepository as never,
      filaRepository as never,
    );

    await service.realocarAdministrativamente(
      {
        servicoOrigemId: 10,
        servicoDestinoId: 11,
        tipoVaga: 'DIA',
        oficialId: 9,
      },
      'OBM de Teste',
    );

    expect(origem.oficial_dia).toBeNull();
    expect(destino.oficial_dia).toEqual({ id: 9 });
    expect(manager.save).toHaveBeenNthCalledWith(1, Servico, [origem, destino]);
    expect(manager.save).toHaveBeenNthCalledWith(
      2,
      Permuta,
      expect.arrayContaining([
        expect.objectContaining({
          oficial_sainte: { id: 9 },
          oficial_entrante: null,
        }),
        expect.objectContaining({
          oficial_sainte: null,
          oficial_entrante: { id: 9 },
        }),
      ]),
    );
  });

  it('recusa solicitação para uma vaga que o oficial já ocupa', async () => {
    const permutaRepository = { create: jest.fn(), save: jest.fn() };
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        escala: { obm: 'OBM de Teste' },
        oficial_dia: { id: 9 },
        oficial_sobreaviso: { id: 3 },
      }),
    };
    const service = new PermutaService(
      permutaRepository as never,
      servicoRepository as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
    );

    await expect(
      service.solicitarPermuta(
        { servicoId: 2, tipoVaga: 'DIA', entranteId: 9 },
        'OBM de Teste',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(permutaRepository.save).not.toHaveBeenCalled();
  });

  it('registra no histórico as duas pontas de um ajuste para vaga livre', async () => {
    const origem = {
      id: 10,
      tipo_escala: 'PRETA',
      escala: { id: 1, obm: 'OBM de Teste', status: 'ABERTA' },
      oficial_dia: { id: 9 },
      oficial_sobreaviso: null,
    };
    const destino = {
      id: 11,
      tipo_escala: 'PRETA',
      escala: { id: 1, obm: 'OBM de Teste', status: 'ABERTA' },
      oficial_dia: null,
      oficial_sobreaviso: null,
    };
    const manager = {
      save: jest.fn(),
      transaction: jest.fn(async (executar) => executar(manager)),
    };
    const permutaRepository = {
      create: jest.fn((registro) => ({ ...registro })),
    };
    const servicoRepository = {
      manager,
      findOne: jest
        .fn()
        .mockResolvedValueOnce(origem)
        .mockResolvedValueOnce(destino),
      find: jest.fn().mockResolvedValue([
        { ...origem, oficial_dia: { id: 9 } },
        { ...destino, oficial_dia: null },
        {
          id: 12,
          tipo_escala: 'PRETA',
          oficial_dia: null,
          oficial_sobreaviso: { id: 9 },
        },
      ]),
    };
    const filaRepository = {
      findOne: jest.fn().mockResolvedValue({
        cota_preta: 1,
        cota_roxa: 0,
        cota_vermelha: 0,
      }),
    };
    const service = new PermutaService(
      permutaRepository as never,
      servicoRepository as never,
      filaRepository as never,
    );

    await service.ajustarEscolha(
      {
        servicoOrigemId: 10,
        tipoVagaOrigem: 'DIA',
        servicoDestinoId: 11,
        tipoVagaDestino: 'DIA',
      },
      9,
      'OBM de Teste',
    );

    expect(manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenNthCalledWith(1, Servico, [origem, destino]);
    expect(manager.save).toHaveBeenNthCalledWith(
      2,
      Permuta,
      expect.arrayContaining([
        expect.objectContaining({
          oficial_sainte: { id: 9 },
          oficial_entrante: null,
        }),
        expect.objectContaining({
          oficial_sainte: null,
          oficial_entrante: { id: 9 },
        }),
      ]),
    );
  });

  it('cria duas permutas vinculadas quando um serviço é oferecido', async () => {
    const alvo = {
      id: 20,
      tipo_escala: 'PRETA',
      escala: { id: 1, obm: 'OBM de Teste' },
      oficial_dia: { id: 8 },
      oficial_sobreaviso: null,
    };
    const oferecido = {
      id: 21,
      tipo_escala: 'PRETA',
      escala: { id: 1, obm: 'OBM de Teste' },
      oficial_dia: { id: 9 },
      oficial_sobreaviso: null,
    };
    const manager = {
      save: jest.fn((_entidade, registros) => registros),
      transaction: jest.fn(async (executar) => executar(manager)),
    };
    const permutaRepository = {
      create: jest.fn((registro) => ({ ...registro })),
      manager,
    };
    const servicoRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(alvo)
        .mockResolvedValueOnce(oferecido),
    };
    const service = new PermutaService(
      permutaRepository as never,
      servicoRepository as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
    );

    await service.solicitarPermuta(
      {
        servicoId: 20,
        tipoVaga: 'DIA',
        entranteId: 9,
        servicoOferecidoId: 21,
        tipoVagaOferecida: 'DIA',
      },
      'OBM de Teste',
    );

    const registros = manager.save.mock.calls[0][1];
    expect(registros).toHaveLength(2);
    expect(registros[0].grupo_troca).toHaveLength(36);
    expect(registros[1].grupo_troca).toBe(registros[0].grupo_troca);
    expect(registros[0].eh_contrapartida).toBe(false);
    expect(registros[1]).toEqual(
      expect.objectContaining({
        eh_contrapartida: true,
        oficial_sainte: { id: 9 },
        oficial_entrante: { id: 8 },
      }),
    );
  });

  it('aprova e efetiva juntas as duas movimentações de uma troca', async () => {
    const grupo = '11111111-1111-4111-8111-111111111111';
    const principal: any = {
      id: 30,
      grupo_troca: grupo,
      eh_contrapartida: false,
      tipo_vaga: 'DIA',
      status: 'PENDENTE_APROVACAO',
      servico: { id: 40, escala: { id: 1, obm: 'OBM de Teste' } },
      oficial_sainte: { id: 8 },
      oficial_entrante: { id: 9 },
    };
    const contrapartida: any = {
      id: 31,
      grupo_troca: grupo,
      eh_contrapartida: true,
      tipo_vaga: 'DIA',
      status: 'PENDENTE_APROVACAO',
      servico: { id: 41, escala: { id: 1, obm: 'OBM de Teste' } },
      oficial_sainte: { id: 9 },
      oficial_entrante: { id: 8 },
    };
    const servicoAlvo: any = {
      id: 40,
      escala: { id: 1, obm: 'OBM de Teste' },
      oficial_dia: { id: 8 },
      oficial_sobreaviso: null,
    };
    const servicoOferecido: any = {
      id: 41,
      escala: { id: 1, obm: 'OBM de Teste' },
      oficial_dia: { id: 9 },
      oficial_sobreaviso: null,
    };
    const manager = {
      save: jest.fn(),
      transaction: jest.fn(async (executar) => executar(manager)),
    };
    const service = new PermutaService(
      {
        findOne: jest.fn().mockResolvedValue(principal),
        find: jest.fn().mockResolvedValue([principal, contrapartida]),
        manager,
      } as never,
      {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(servicoAlvo)
          .mockResolvedValueOnce(servicoOferecido),
      } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
    );

    await service.responderPermuta(
      30,
      'SIM',
      'ESCALANTE',
      undefined,
      'OBM de Teste',
    );

    expect(principal.status).toBe('APROVADA');
    expect(contrapartida.status).toBe('APROVADA');
    expect(servicoAlvo.oficial_dia).toEqual({ id: 9 });
    expect(servicoOferecido.oficial_dia).toEqual({ id: 8 });
    expect(manager.save).toHaveBeenCalledWith(Servico, [
      servicoAlvo,
      servicoOferecido,
    ]);
    expect(manager.save).toHaveBeenCalledWith(Permuta, [
      principal,
      contrapartida,
    ]);
  });

  it('registra em conjunto o aceite do destinatário de uma troca', async () => {
    const grupo = '22222222-2222-4222-8222-222222222222';
    const principal: any = {
      id: 50,
      grupo_troca: grupo,
      eh_contrapartida: false,
      status: 'PENDENTE_ACORDO',
      servico: { id: 60, escala: { obm: 'OBM de Teste' } },
      oficial_sainte: { id: 8 },
      oficial_entrante: { id: 9 },
    };
    const contrapartida: any = {
      id: 51,
      grupo_troca: grupo,
      eh_contrapartida: true,
      status: 'PENDENTE_ACORDO',
      servico: { id: 61, escala: { obm: 'OBM de Teste' } },
      oficial_sainte: { id: 9 },
      oficial_entrante: { id: 8 },
    };
    const manager = {
      save: jest.fn((_entidade, registros) => registros),
      transaction: jest.fn(async (executar) => executar(manager)),
    };
    const service = new PermutaService(
      {
        findOne: jest.fn().mockResolvedValue(principal),
        find: jest.fn().mockResolvedValue([principal, contrapartida]),
        manager,
      } as never,
      {} as never,
      {} as never,
    );

    await service.responderComoOficial(50, 8, 'SIM', undefined, 'OBM de Teste');

    expect(principal.status).toBe('PENDENTE_APROVACAO');
    expect(contrapartida.status).toBe('PENDENTE_APROVACAO');
    expect(manager.save).toHaveBeenCalledWith(Permuta, [
      principal,
      contrapartida,
    ]);
  });

  it('exige motivo quando o escalante indefere uma permuta', async () => {
    const permutaRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 70,
        grupo_troca: null,
        status: 'PENDENTE_APROVACAO',
        servico: { escala: { obm: 'OBM de Teste' } },
        oficial_sainte: { id: 8 },
        oficial_entrante: { id: 9 },
      }),
      save: jest.fn(),
    };
    const service = new PermutaService(
      permutaRepository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.responderPermuta(
        70,
        'NAO',
        'ESCALANTE',
        undefined,
        'OBM de Teste',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(permutaRepository.save).not.toHaveBeenCalled();
  });
});
