import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_PASSWORD_CHANGE_REQUIRED_KEY } from '../decorators/allow-password-change-required.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { Oficial } from '../../oficial/entities/oficial.entity';

@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Oficial)
    private readonly oficialRepository: Repository<Oficial>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const publicRoute = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (publicRoute) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) return true;

    const oficial = await this.oficialRepository.findOne({
      where: { id: request.user.id },
      select: {
        id: true,
        ativo: true,
        deve_alterar_senha: true,
        versao_autenticacao: true,
      },
    });
    if (!oficial?.ativo) {
      throw new UnauthorizedException(
        'A conta não está disponível para acesso.',
      );
    }
    if (
      oficial.versao_autenticacao !== (request.user.versaoAutenticacao ?? 0)
    ) {
      throw new UnauthorizedException(
        'A sessão expirou após uma alteração de senha. Entre novamente.',
      );
    }
    if (!oficial.deve_alterar_senha || allowed) return true;

    throw new ForbiddenException(
      'Você precisa definir uma nova senha antes de acessar o sistema.',
    );
  }
}
