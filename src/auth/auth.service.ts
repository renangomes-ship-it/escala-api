import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Oficial } from '../oficial/entities/oficial.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Oficial)
    private oficialRepository: Repository<Oficial>,
    private jwtService: JwtService
  ) {}

  async validarOficial(rg: string, senhaLimpa: string): Promise<any> {
    const oficial = await this.oficialRepository.findOne({ where: { rg } });
    
    if (oficial && await bcrypt.compare(senhaLimpa, oficial.senha)) {
      const { senha, ...result } = oficial;
      return result;
    }
    throw new UnauthorizedException('RG ou senha inválidos.');
  }

  async login(oficial: any) {
    const payload = { 
      sub: oficial.id, 
      rg: oficial.rg, 
      posto: oficial.posto_graduacao,
      nome: oficial.nome,
      obm: oficial.obm,
      role: oficial.role 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      oficial: payload
    };
  }
}