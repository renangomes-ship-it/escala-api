import * as bcrypt from 'bcrypt';
import { OficialService } from './oficial.service';

describe('OficialService', () => {
  it('persiste a senha de um novo oficial usando hash', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const service = new OficialService(repository as never);

    const oficial = await service.create({
      nome: 'Oficial de Teste',
      posto_graduacao: 'Capitão',
      data_ultima_promocao: '2020-01-01',
      rg: '123',
      email: 'teste@example.com',
      senha: 'senha-segura',
    });

    const dadosPersistidos = repository.save.mock.calls[0][0];
    expect(dadosPersistidos.senha).not.toBe('senha-segura');
    expect(dadosPersistidos.deve_alterar_senha).toBe(true);
    await expect(bcrypt.compare('senha-segura', dadosPersistidos.senha)).resolves.toBe(true);
    expect(oficial).not.toHaveProperty('senha');
  });

  it('aplica hash antes de atualizar uma senha', async () => {
    const repository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneBy: jest.fn().mockResolvedValue({ id: 4 }),
    };
    const service = new OficialService(repository as never);

    await service.update(4, { senha: 'nova-senha' }, undefined, true);

    const dadosAtualizados = repository.update.mock.calls[0][1];
    expect(dadosAtualizados.senha).not.toBe('nova-senha');
    expect(dadosAtualizados.deve_alterar_senha).toBe(true);
    await expect(bcrypt.compare('nova-senha', dadosAtualizados.senha)).resolves.toBe(true);
  });

  it('lista somente ativos na consulta de oficiais disponíveis e ordena por antiguidade', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([
        { id: 3, posto_graduacao: 'Capitão', data_ultima_promocao: '2022-01-01', rg: '30' },
        { id: 1, posto_graduacao: 'Major', data_ultima_promocao: '2024-01-01', rg: '10' },
        { id: 2, posto_graduacao: 'Capitão', data_ultima_promocao: '2020-01-01', rg: '20' },
      ]),
    };
    const service = new OficialService(repository as never);

    const oficiais = await service.findAll('QG', true);

    expect(repository.find).toHaveBeenCalledWith({ where: { obm: 'QG', ativo: true } });
    expect(oficiais.map((oficial) => oficial.id)).toEqual([1, 2, 3]);
  });

  it('inativa em vez de excluir o registro do oficial', async () => {
    const repository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new OficialService(repository as never);

    await service.remove(7, 'QG');

    expect(repository.update).toHaveBeenCalledWith({ id: 7, obm: 'QG' }, { ativo: false });
  });
});
