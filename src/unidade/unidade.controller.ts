import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../oficial/entities/oficial.entity';
import { UpdateUnidadeDto } from './dto/update-unidade.dto';
import { UnidadeService } from './unidade.service';

@Controller('unidade')
export class UnidadeController {
  constructor(private readonly unidadeService: UnidadeService) {}

  @Get()
  @Roles(Role.OFICIAL, Role.ESCALANTE, Role.ADMINISTRADOR, Role.ADMIN_MASTER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.unidadeService.findAll(user.role === Role.ADMIN_MASTER);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_MASTER)
  update(@Param('id') id: string, @Body() body: UpdateUnidadeDto) {
    return this.unidadeService.update(+id, body.ativo);
  }
}
