import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PasswordChangeRequiredGuard } from './password-change-required.guard';

function contexto(user: Record<string, unknown>) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}

describe('PasswordChangeRequiredGuard', () => {
  it('bloqueia qualquer rota comum enquanto a troca estiver pendente no banco', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        ativo: true,
        deve_alterar_senha: true,
        versao_autenticacao: 0,
      }),
    };
    const guard = new PasswordChangeRequiredGuard(
      reflector as unknown as Reflector,
      repository as never,
    );

    await expect(
      guard.canActivate(contexto({ id: 2 }) as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite a rota específica de alteração de senha', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true),
    };
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        ativo: true,
        deve_alterar_senha: true,
        versao_autenticacao: 0,
      }),
    };
    const guard = new PasswordChangeRequiredGuard(
      reflector as unknown as Reflector,
      repository as never,
    );

    await expect(guard.canActivate(contexto({ id: 2 }) as never)).resolves.toBe(
      true,
    );
  });

  it('recusa imediatamente uma conta que foi inativada após o login', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        ativo: false,
        versao_autenticacao: 0,
      }),
    };
    const guard = new PasswordChangeRequiredGuard(
      reflector as unknown as Reflector,
      repository as never,
    );

    await expect(
      guard.canActivate(contexto({ id: 2 }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token emitido antes da última alteração de senha', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 2,
        ativo: true,
        deve_alterar_senha: false,
        versao_autenticacao: 2,
      }),
    };
    const guard = new PasswordChangeRequiredGuard(
      reflector as unknown as Reflector,
      repository as never,
    );

    await expect(
      guard.canActivate(contexto({ id: 2, versaoAutenticacao: 1 }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
