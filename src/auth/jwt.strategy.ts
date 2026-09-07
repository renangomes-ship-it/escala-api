import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Extrai o token do cabeçalho da requisição
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'CHAVE_SECRETA_DO_SEU_SISTEMA', 
    });
  }

  // O NestJS chama esse método automaticamente se o token for válido
  async validate(payload: any) {
    return { 
      id: payload.sub, 
      rg: payload.rg, 
      posto: payload.posto, 
      role: payload.role // O RolesGuard vai ler exatamente isso aqui!
    };
  }
}