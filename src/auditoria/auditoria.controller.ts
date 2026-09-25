import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../oficial/entities/oficial.entity';
import { AuditoriaService } from './auditoria.service';

@Controller('auditoria')
@Roles(Role.ADMINISTRADOR, Role.ADMIN_MASTER)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unidade') unidade?: string,
    @Query('acao') acao?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('limite') limite?: string,
  ) {
    return this.auditoriaService.listar(
      user.role === Role.ADMIN_MASTER ? undefined : (user.obm ?? undefined),
      {
        unidade: unidade?.trim() || undefined,
        acao: acao?.trim() || undefined,
        inicio: inicio?.trim() || undefined,
        fim: fim?.trim() || undefined,
        limite: limite ? Number(limite) : undefined,
      },
    );
  }
}
