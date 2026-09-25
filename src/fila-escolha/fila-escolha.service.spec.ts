import { FilaEscolhaService } from './fila-escolha.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('FilaEscolhaService', () => {
  it('gera registros da fila sem acessar o banco real', async () => {
    const filaRepository = {
      delete: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([
        { status: 'AGUARDANDO' },
        { status: 'AGUARDANDO' },
      ]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = new FilaEscolhaService(
      filaRepository as never,
      {
        find: jest.fn().mockResolvedValue([
          { tipo_escala: 'PRETA' },
          { tipo_escala: 'VERMELHA' },
        ]),
      } as never,
      { findOne: jest.fn().mockResolvedValue({ id: 1 }) } as never,
    );

    await service.gerarFila(1, [
      {
        oficialId: 2,
        apto: true,
        cotas: { pretas: 1, roxas: 0, vermelhas: 1 },
      },
    ]);

    expect(filaRepository.delete).toHaveBeenCalledWith({ escala: { id: 1 } });
    expect(filaRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ posicao: 1, cota_preta: 1, cota_vermelha: 1 }),
    ]);
  });

  it('bloqueia a fila quando um oficial apto recebe cota total zero', async () => {
    const filaRepository = { delete: jest.fn(), create: jest.fn(), save: jest.fn() };
    const service = new FilaEscolhaService(
      filaRepository as never,
      { find: jest.fn().mockResolvedValue([{ tipo_escala: 'PRETA' }]) } as never,
      { findOne: jest.fn().mockResolvedValue({ id: 1 }) } as never,
    );

    await expect(
      service.gerarFila(1, [
        { oficialId: 2, apto: true, cotas: { pretas: 0, roxas: 0, vermelhas: 0 } },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(filaRepository.delete).not.toHaveBeenCalled();
  });

  it('exige justificativa para oficial inapto antes de alterar a fila', async () => {
    const filaRepository = { delete: jest.fn(), create: jest.fn(), save: jest.fn() };
    const service = new FilaEscolhaService(
      filaRepository as never,
      { find: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue({ id: 1 }) } as never,
    );

    await expect(
      service.gerarFila(1, [
        {
          oficialId: 2,
          apto: false,
          justificativaInaptidao: '   ',
          cotas: { pretas: 0, roxas: 0, vermelhas: 0 },
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(filaRepository.delete).not.toHaveBeenCalled();
  });

  it('não permite escolher um serviço que não pertence à escala do turno', async () => {
    const filaRepository = {
      findOne: jest.fn().mockResolvedValue({
        cota_preta: 1,
        cota_roxa: 0,
        cota_vermelha: 0,
        limite_turno: new Date(Date.now() + 60 * 60 * 1000),
      }),
    };
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn(),
      save: jest.fn(),
    };
    const service = new FilaEscolhaService(
      filaRepository as never,
      servicoRepository as never,
      { findOne: jest.fn().mockResolvedValue({ id: 1 }) } as never,
    );

    await expect(service.registrarEscolhaVaga(1, 2, 99, 'DIA')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(servicoRepository.save).not.toHaveBeenCalled();
  });

  it('impede o mesmo oficial de escolher titular e sobreaviso no mesmo dia', async () => {
    const filaRepository = {
      findOne: jest.fn().mockResolvedValue({
        cota_preta: 1,
        cota_roxa: 0,
        cota_vermelha: 0,
        limite_turno: new Date(Date.now() + 60 * 60 * 1000),
      }),
    };
    const servicoRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 3,
        tipo_escala: 'PRETA',
        oficial_dia: null,
        oficial_sobreaviso: { id: 2 },
      }),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn(),
    };
    const service = new FilaEscolhaService(
      filaRepository as never,
      servicoRepository as never,
      { findOne: jest.fn().mockResolvedValue({ id: 1 }) } as never,
    );

    await expect(service.registrarEscolhaVaga(1, 2, 3, 'DIA')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(servicoRepository.save).not.toHaveBeenCalled();
  });

  it('concede uma hora ao oficial que reivindica a vez', async () => {
    const reivindicante = { id: 10, posicao: 4, status: 'PULADO' };
    const turnoAtual = {
      id: 11,
      posicao: 6,
      status: 'ESCOLHENDO',
      limite_turno: new Date(Date.now() + 4 * 60 * 60 * 1000),
    };
    const filaRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(reivindicante)
        .mockResolvedValueOnce(turnoAtual),
      save: jest.fn(),
    };
    const service = new FilaEscolhaService(
      filaRepository as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue({ id: 1 }) } as never,
    );

    await service.reivindicarVez(1, 10);

    expect(turnoAtual.status).toBe('INTERROMPIDO');
    expect(reivindicante.status).toBe('ESCOLHENDO');
    expect(
      new Date(reivindicante.limite_turno).getTime() -
        new Date(reivindicante.inicio_turno).getTime(),
    ).toBeLessThanOrEqual(60 * 60 * 1000);
    expect(
      new Date(reivindicante.limite_turno).getTime() -
        new Date(reivindicante.inicio_turno).getTime(),
    ).toBeGreaterThan(59 * 60 * 1000);
  });

  it('encaminha para ajuste manual quando o último oficial precisaria das duas funções no mesmo dia', async () => {
    const filaRepository = {
      find: jest.fn().mockResolvedValue([
        {
          status: 'AGUARDANDO',
          oficial: { id: 2, nome: 'Último Oficial' },
          cota_preta: 1,
          cota_roxa: 0,
          cota_vermelha: 0,
        },
        { status: 'FINALIZADO', oficial: { id: 3 } },
      ]),
      save: jest.fn(),
    };
    const escalaRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    const service = new FilaEscolhaService(
      filaRepository as never,
      {
        find: jest.fn().mockResolvedValue([
          { tipo_escala: 'PRETA', oficial_dia: null, oficial_sobreaviso: null },
        ]),
        save: jest.fn(),
      } as never,
      escalaRepository as never,
    );

    await expect((service as any).atribuirUltimoOficial(1)).resolves.toEqual({
      bloqueada: true,
    });
    expect(escalaRepository.update).toHaveBeenCalledWith(1, {
      status: 'PENDENTE_AJUSTE_MANUAL',
    });
  });

  it('passa automaticamente um turno comum vencido', async () => {
    const filaRepository = {
      find: jest.fn().mockResolvedValue([
        {
          status: 'ESCOLHENDO',
          limite_turno: new Date(Date.now() - 1000),
          observacao: '',
          escala: { id: 4, obm: 'OBM de Teste' },
        },
      ]),
    };
    const service = new FilaEscolhaService(
      filaRepository as never,
      {} as never,
      {} as never,
    );
    const passarTurno = jest.spyOn(service, 'passarTurno').mockResolvedValue({
      mensagem: 'Turno passado.',
    });

    await service.processarTurnosVencidos();

    expect(passarTurno).toHaveBeenCalledWith(4, 'OBM de Teste');
  });

  it('mantém para o escalante o turno vencido de quem voltou ao fim da fila', async () => {
    const filaRepository = {
      find: jest.fn().mockResolvedValue([
        {
          status: 'ESCOLHENDO',
          limite_turno: new Date(Date.now() - 1000),
          observacao: 'RETORNO_FIM_FILA',
          escala: { id: 4, obm: 'OBM de Teste' },
        },
      ]),
    };
    const service = new FilaEscolhaService(
      filaRepository as never,
      {} as never,
      {} as never,
    );
    const passarTurno = jest.spyOn(service, 'passarTurno');

    await service.processarTurnosVencidos();

    expect(passarTurno).not.toHaveBeenCalled();
  });

  it('conclui manualmente o último oficial somente após cumprir as cotas', async () => {
    const registro = {
      id: 9,
      oficial: { id: 3, nome: 'Oficial de Teste' },
      status: 'AGUARDANDO',
      observacao: '',
      cota_preta: 1,
      cota_roxa: 0,
      cota_vermelha: 0,
    };
    const filaRepository = {
      find: jest
        .fn()
        .mockResolvedValueOnce([registro])
        .mockImplementation(async () => [registro]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (value) => value),
    };
    const servicoRepository = {
      count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0).mockResolvedValueOnce(0),
      find: jest.fn().mockResolvedValue([
        {
          tipo_escala: 'PRETA',
          oficial_dia: { id: 3 },
          oficial_sobreaviso: null,
        },
        {
          tipo_escala: 'PRETA',
          oficial_dia: null,
          oficial_sobreaviso: { id: 3 },
        },
      ]),
    };
    const escalaRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 1, status: 'PENDENTE_AJUSTE_MANUAL' }),
      update: jest.fn(),
    };
    const service = new FilaEscolhaService(
      filaRepository as never,
      servicoRepository as never,
      escalaRepository as never,
    );

    await expect(service.finalizarEscolhaManual(1, 3)).resolves.toEqual(
      expect.objectContaining({ mensagem: expect.stringContaining('Escolha manual concluída') }),
    );
    expect(registro.status).toBe('FINALIZADO');
    expect(registro.observacao).toBe('CONCLUIDO_MANUALMENTE');
    expect(escalaRepository.update).toHaveBeenCalledWith(1, { status: 'ABERTA' });
  });

  it('recusa concluir manualmente quando ainda falta cota', async () => {
    const registro = {
      id: 9,
      oficial: { id: 3 },
      status: 'ESCOLHENDO',
      observacao: 'RETORNO_FIM_FILA',
      limite_turno: new Date(Date.now() - 1000),
      cota_preta: 1,
      cota_roxa: 0,
      cota_vermelha: 0,
    };
    const filaRepository = {
      find: jest.fn().mockResolvedValue([registro]),
      save: jest.fn(),
    };
    const servicoRepository = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn(),
    };
    const service = new FilaEscolhaService(
      filaRepository as never,
      servicoRepository as never,
      { findOne: jest.fn().mockResolvedValue({ id: 1, status: 'ABERTA' }) } as never,
    );

    await expect(service.finalizarEscolhaManual(1, 3)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(filaRepository.save).not.toHaveBeenCalled();
    expect(servicoRepository.find).not.toHaveBeenCalled();
  });

  it('não permite ações da fila em escala arquivada', async () => {
    const filaRepository = { findOne: jest.fn(), save: jest.fn() };
    const service = new FilaEscolhaService(
      filaRepository as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue({ id: 1, status: 'ARQUIVADA' }) } as never,
    );

    await expect(service.passarTurno(1)).rejects.toBeInstanceOf(BadRequestException);
    expect(filaRepository.findOne).not.toHaveBeenCalled();
  });
});
