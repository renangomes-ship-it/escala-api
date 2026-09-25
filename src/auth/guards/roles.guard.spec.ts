import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const context = (role?: string) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    }) as never;

  it('permite uma rota sem perfil exigido', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as never);

    expect(guard.canActivate(context())).toBe(true);
  });

  it('permite apenas o perfil exigido pela rota', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === 'isPublic' ? false : ['ESCALANTE'],
      ),
    };
    const guard = new RolesGuard(reflector as never);

    expect(guard.canActivate(context('ESCALANTE'))).toBe(true);
    expect(guard.canActivate(context('OFICIAL'))).toBe(false);
  });
});
