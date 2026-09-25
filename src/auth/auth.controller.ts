import { BadRequestException, Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { LoginDto } from './dto/login.dto';
import { ValidatePasswordDto } from './dto/validate-password.dto';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { AllowPasswordChangeRequired } from './decorators/allow-password-change-required.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  async login(@Body() body: LoginDto) {
    if (!body.rg || !body.senha) {
      throw new UnauthorizedException('RG e senha são obrigatórios.');
    }
    
    const oficial = await this.authService.validarOficial(body.rg, body.senha);
    return this.authService.login(oficial);
  }

  @Post('alterar-senha')
  @AllowPasswordChangeRequired()
  async alterarSenha(
    @Body() body: AlterarSenhaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (body.novaSenha !== body.confirmacaoNovaSenha) {
      throw new BadRequestException('A confirmação da nova senha não confere.');
    }
    return this.authService.alterarSenha(user.id, body.senhaAtual, body.novaSenha);
  }

  // NOVA ROTA: Apenas valida a senha para ações críticas (ex: exclusão)
  @Post('validate-password')
  async validatePassword(
    @Body() body: ValidatePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body.senha) {
      throw new UnauthorizedException('A senha é obrigatória.');
    }
    // Se a senha estiver errada, o validarOficial já lança um erro 401 automaticamente
    await this.authService.validarOficial(user.rg, body.senha);
    return { valido: true };
  }
}
