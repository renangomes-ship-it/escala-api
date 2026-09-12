import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { rg: string; senha: string }) {
    if (!body.rg || !body.senha) {
      throw new UnauthorizedException('RG e senha são obrigatórios.');
    }
    
    const oficial = await this.authService.validarOficial(body.rg, body.senha);
    return this.authService.login(oficial);
  }

  // NOVA ROTA: Apenas valida a senha para ações críticas (ex: exclusão)
  @Post('validate-password')
  async validatePassword(@Body() body: { rg: string; senha: string }) {
    if (!body.rg || !body.senha) {
      throw new UnauthorizedException('RG e senha são obrigatórios.');
    }
    // Se a senha estiver errada, o validarOficial já lança um erro 401 automaticamente
    await this.authService.validarOficial(body.rg, body.senha);
    return { valido: true };
  }
}