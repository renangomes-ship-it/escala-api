import { Controller, Get, Post, Body, Patch, Param, Delete, ForbiddenException } from '@nestjs/common';
import { ServicoService } from './servico.service';
import { CreateServicoDto } from './dto/create-servico.dto';
import { UpdateServicoDto } from './dto/update-servico.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../oficial/entities/oficial.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('servico')
export class ServicoController {
  constructor(private readonly servicoService: ServicoService) {}

  private obmDoUsuario(user: AuthenticatedUser): string | undefined {
    if (user.role === Role.ADMIN_MASTER) return undefined;
    if (!user.obm) {
      throw new ForbiddenException('O usuário autenticado não possui uma OBM vinculada.');
    }
    return user.obm;
  }

  @Post()
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  create(@Body() createServicoDto: CreateServicoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.servicoService.create(createServicoDto, this.obmDoUsuario(user));
  }

  @Get()
  @Roles(Role.ESCALANTE, Role.ADMINISTRADOR, Role.ADMIN_MASTER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.servicoService.findAll(
      this.obmDoUsuario(user),
      user.role === Role.ADMINISTRADOR || user.role === Role.ADMIN_MASTER,
    );
  }

  @Get(':id')
  @Roles(Role.ESCALANTE, Role.ADMINISTRADOR, Role.ADMIN_MASTER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.servicoService.findOne(
      +id,
      this.obmDoUsuario(user),
      user.role === Role.ADMINISTRADOR || user.role === Role.ADMIN_MASTER,
    );
  }

  @Patch(':id')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  update(@Param('id') id: string, @Body() updateServicoDto: UpdateServicoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.servicoService.update(+id, updateServicoDto, this.obmDoUsuario(user));
  }

  @Delete(':id')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.servicoService.remove(+id, this.obmDoUsuario(user));
  }
}
