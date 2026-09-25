import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { getJwtSecret } from '../config/environment';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Extrai o token do cabeçalho da requisição
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  // O NestJS chama esse método automaticamente se o token for válido
  async validate(payload: any): Promise<AuthenticatedUser> {
    return { 
      id: payload.sub, 
      rg: payload.rg, 
      posto: payload.posto,
      nome: payload.nome,
      obm: payload.obm === 'QG CBMERJ' ? 'QCG' : payload.obm,
      role: payload.role,
      deveAlterarSenha: Boolean(payload.deveAlterarSenha),
      versaoAutenticacao: Number(payload.versaoAutenticacao ?? 0),
    };
  }
}
