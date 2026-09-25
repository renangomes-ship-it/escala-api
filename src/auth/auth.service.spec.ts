import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  it('inclui os dados necessários no token emitido durante o login', async () => {
    const jwtService = { sign: jest.fn().mockReturnValue('token-de-teste') };
    const service = new AuthService({} as never, jwtService as never);

    expect(
      service.login({
        id: 1,
        rg: '123',
        posto_graduacao: 'Capitão',
        nome: 'Oficial de Teste',
        obm: 'OBM de Teste',
        role: 'OFICIAL',
        deve_alterar_senha: false,
        versao_autenticacao: 0,
      }),
    ).toEqual({
      access_token: 'token-de-teste',
      oficial: {
        sub: 1,
        rg: '123',
        posto: 'Capitão',
        nome: 'Oficial de Teste',
        obm: 'OBM de Teste',
        role: 'OFICIAL',
        deveAlterarSenha: false,
        versaoAutenticacao: 0,
      },
    });
  });

  it('troca a senha, encerra a obrigatoriedade e emite um novo token', async () => {
    const senhaAtual = await bcrypt.hash('senha-temporaria', 10);
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        rg: '123',
        posto_graduacao: 'Capitão',
        nome: 'Oficial de Teste',
        obm: 'QCG',
        role: 'OFICIAL',
        ativo: true,
        senha: senhaAtual,
        deve_alterar_senha: true,
        versao_autenticacao: 0,
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const jwtService = { sign: jest.fn().mockReturnValue('novo-token') };
    const service = new AuthService(repository as never, jwtService as never);

    await expect(
      service.alterarSenha(1, 'senha-temporaria', 'senha-nova-segura'),
    ).resolves.toEqual(
      expect.objectContaining({
        access_token: 'novo-token',
        oficial: expect.objectContaining({ deveAlterarSenha: false }),
      }),
    );
    const atualizacao = repository.update.mock.calls[0][1];
    expect(atualizacao.deve_alterar_senha).toBe(false);
    expect(atualizacao.versao_autenticacao).toBe(1);
    await expect(
      bcrypt.compare('senha-nova-segura', atualizacao.senha),
    ).resolves.toBe(true);
  });

  it('não autentica oficial inativo, mesmo com senha correta', async () => {
    const senha = await bcrypt.hash('senha-segura', 10);
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        rg: '123',
        senha,
        ativo: false,
      }),
    };
    const service = new AuthService(repository as never, {} as never);

    await expect(service.validarOficial('123', 'senha-segura')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rg: '123' },
        select: expect.objectContaining({ senha: true }),
      }),
    );
  });
});
