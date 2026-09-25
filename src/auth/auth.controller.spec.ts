import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const authService = {
    validarOficial: jest.fn(),
    login: jest.fn(),
    alterarSenha: jest.fn(),
  };
  const controller = new AuthController(authService as never);

  beforeEach(() => jest.clearAllMocks());

  it('encaminha as credenciais recebidas para o serviço de autenticação', async () => {
    authService.validarOficial.mockResolvedValue({ id: 1 });
    authService.login.mockReturnValue({ access_token: 'token-de-teste' });

    await expect(controller.login({ rg: '123', senha: 'senha' })).resolves.toEqual({
      access_token: 'token-de-teste',
    });
    expect(authService.validarOficial).toHaveBeenCalledWith('123', 'senha');
  });

  it('altera a senha do próprio usuário autenticado', async () => {
    authService.alterarSenha.mockResolvedValue({ access_token: 'novo-token' });

    await expect(
      controller.alterarSenha(
        {
          senhaAtual: 'senha-temporaria',
          novaSenha: 'senha-nova-segura',
          confirmacaoNovaSenha: 'senha-nova-segura',
        },
        {
          id: 4,
          rg: '123',
          posto: 'Capitão',
          obm: 'QCG',
          role: 'OFICIAL' as never,
        },
      ),
    ).resolves.toEqual({ access_token: 'novo-token' });
    expect(authService.alterarSenha).toHaveBeenCalledWith(
      4,
      'senha-temporaria',
      'senha-nova-segura',
    );
  });

  it('rejeita login sem RG ou senha', async () => {
    await expect(controller.login({ rg: '', senha: '' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
