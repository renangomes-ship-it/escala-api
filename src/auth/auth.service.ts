import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Oficial } from '../oficial/entities/oficial.entity';
import * as bcrypt from 'bcrypt';

type OficialParaToken = Pick<
  Oficial,
  | 'id'
  | 'rg'
  | 'posto_graduacao'
  | 'nome'
  | 'obm'
  | 'role'
  | 'deve_alterar_senha'
  | 'versao_autenticacao'
>;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Oficial)
    private oficialRepository: Repository<Oficial>,
    private jwtService: JwtService,
  ) {}

  async validarOficial(
    rg: string,
    senhaLimpa: string,
  ): Promise<OficialParaToken> {
    const oficial = await this.oficialRepository.findOne({
      where: { rg },
      select: {
        id: true,
        rg: true,
        posto_graduacao: true,
        nome: true,
        obm: true,
        role: true,
        ativo: true,
        senha: true,
        deve_alterar_senha: true,
        versao_autenticacao: true,
      },
    });

    if (oficial?.ativo && (await bcrypt.compare(senhaLimpa, oficial.senha))) {
      return {
        id: oficial.id,
        rg: oficial.rg,
        posto_graduacao: oficial.posto_graduacao,
        nome: oficial.nome,
        obm: oficial.obm,
        role: oficial.role,
        deve_alterar_senha: oficial.deve_alterar_senha,
        versao_autenticacao: oficial.versao_autenticacao,
      };
    }
    throw new UnauthorizedException('RG ou senha inválidos.');
  }

  login(oficial: OficialParaToken) {
    const payload = {
      sub: oficial.id,
      rg: oficial.rg,
      posto: oficial.posto_graduacao,
      nome: oficial.nome,
      obm: oficial.obm,
      role: oficial.role,
      deveAlterarSenha: Boolean(oficial.deve_alterar_senha),
      versaoAutenticacao: oficial.versao_autenticacao ?? 0,
    };

    return {
      access_token: this.jwtService.sign(payload),
      oficial: payload,
    };
  }

  async alterarSenha(id: number, senhaAtual: string, novaSenha: string) {
    const oficial = await this.oficialRepository.findOne({
      where: { id, ativo: true },
      select: {
        id: true,
        rg: true,
        posto_graduacao: true,
        nome: true,
        obm: true,
        role: true,
        senha: true,
        deve_alterar_senha: true,
        versao_autenticacao: true,
      },
    });
    if (!oficial || !(await bcrypt.compare(senhaAtual, oficial.senha))) {
      throw new UnauthorizedException('A senha atual está incorreta.');
    }
    if (await bcrypt.compare(novaSenha, oficial.senha)) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da senha atual.',
      );
    }

    await this.oficialRepository.update(id, {
      senha: await bcrypt.hash(novaSenha, 10),
      deve_alterar_senha: false,
      versao_autenticacao: oficial.versao_autenticacao + 1,
    });
    return this.login({
      ...oficial,
      deve_alterar_senha: false,
      versao_autenticacao: oficial.versao_autenticacao + 1,
    });
  }
}
