import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../oficial/entities/oficial.entity';
import { RelatorioService } from './relatorio.service';

@Controller('relatorios')
@Roles(Role.ESCALANTE, Role.ADMINISTRADOR, Role.ADMIN_MASTER)
export class RelatorioController {
  constructor(private readonly relatorioService: RelatorioService) {}

  @Get('escalas/:id')
  gerarEscala(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== Role.ADMIN_MASTER && !user.obm) {
      throw new ForbiddenException(
        'O usuário autenticado não possui uma OBM vinculada.',
      );
    }
    return this.relatorioService.gerarEscala(
      id,
      user.role === Role.ADMIN_MASTER ? undefined : user.obm!,
    );
  }
}
