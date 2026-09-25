import { OficialController } from './oficial.controller';
import { BadRequestException } from '@nestjs/common';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { Role } from './entities/oficial.entity';

describe('OficialController', () => {
  it('reserva a gestão do efetivo a administradores e o cadastro ao Master', () => {
    expect(Reflect.getMetadata(ROLES_KEY, OficialController)).toEqual([
      Role.ADMINISTRADOR,
      Role.ADMIN_MASTER,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, OficialController.prototype.create)).toEqual([
      Role.ADMIN_MASTER,
    ]);
  });

  it('exige OBM ao cadastrar qualquer perfil que não seja Master', async () => {
    const service = { create: jest.fn() };
    const controller = new OficialController(service as never, {} as never);

    await expect(controller.create({
      nome: 'Novo Oficial',
      posto_graduacao: 'Capitão',
      data_ultima_promocao: '2020-01-01',
      rg: '123',
      email: 'novo@example.com',
      senha: 'senha-segura',
      role: Role.OFICIAL,
    }, {
      id: 1,
      rg: '1',
      posto: 'Coronel',
      obm: null,
      role: Role.ADMIN_MASTER,
    })).rejects.toThrow(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('converte o identificador antes de encaminhar a busca', () => {
    const service = { findOne: jest.fn() };
    const controller = new OficialController(service as never, {} as never);

    controller.findOne('12', {
      id: 1,
      rg: '123',
      posto: 'Capitão',
      obm: 'OBM de Teste',
      role: 'ESCALANTE' as never,
    });

    expect(service.findOne).toHaveBeenCalledWith(12, 'OBM de Teste');
  });

  it('impede que o usuário conectado inative a própria conta', async () => {
    const service = { update: jest.fn() };
    const controller = new OficialController(service as never, {} as never);

    await expect(controller.update('1', { ativo: false }, {
      id: 1,
      rg: '123',
      posto: 'Capitão',
      obm: 'QG',
      role: 'ADMINISTRADOR' as never,
    })).rejects.toThrow(BadRequestException);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('limita o administrador da unidade a situação e função do próprio efetivo', async () => {
    const service = {
      findOne: jest.fn().mockResolvedValue({ id: 2, role: 'OFICIAL' }),
      update: jest.fn().mockResolvedValue({ id: 2 }),
    };
    const controller = new OficialController(service as never, {} as never);

    await controller.update('2', {
      nome: 'Nome que deve ser ignorado',
      ativo: false,
      role: 'ESCALANTE' as never,
    }, {
      id: 1,
      rg: '123',
      posto: 'Coronel',
      obm: 'QG',
      role: 'ADMINISTRADOR' as never,
    });

    expect(service.update).toHaveBeenCalledWith(
      2,
      { ativo: false, role: 'ESCALANTE' },
      'QG',
    );
  });

  it('marca como temporária a senha redefinida pelo Master para outro usuário', async () => {
    const service = { update: jest.fn().mockResolvedValue({ id: 2 }) };
    const controller = new OficialController(service as never, {} as never);

    await controller.update(
      '2',
      { senha: 'senha-temporaria' },
      {
        id: 1,
        rg: '1',
        posto: 'Coronel',
        obm: null,
        role: Role.ADMIN_MASTER,
      },
    );

    expect(service.update).toHaveBeenCalledWith(
      2,
      { senha: 'senha-temporaria' },
      undefined,
      true,
    );
  });
});
