import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../oficial/entities/oficial.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Olha para a rota e vê quais perfis são exigidos
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // Se a rota não exige nenhum perfil específico, libera o acesso
    if (!requiredRoles) {
      return true;
    }

    // Pega o usuário logado (injetado no request pelo JwtStrategy)
    const { user } = context.switchToHttp().getRequest();

    // Verifica se a role do usuário está dentro das roles permitidas para a rota
    return requiredRoles.some((role) => user?.role === role);
  }
}
