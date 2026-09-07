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
}