import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EscalaService } from './escala.service';
import { UpdateEscalaDto } from './dto/update-escala.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../oficial/entities/oficial.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UnidadeService } from '../unidade/unidade.service';
import { PreparacaoEscalaService } from './preparacao-escala.service';
import { PrepararEscalaDto } from './dto/preparar-escala.dto';

@Controller('escala')
export class EscalaController {
  constructor(
    private readonly escalaService: EscalaService,
    private readonly unidadeService: UnidadeService,
    private readonly preparacaoEscalaService: PreparacaoEscalaService,
  ) {}

  private obmDoUsuario(user: AuthenticatedUser): string {
    if (!user.obm) {
      throw new ForbiddenException('O usuário autenticado não possui uma OBM vinculada.');
    }
    return user.obm;
  }

  private ocultarJustificativasDeInaptidao<T extends { fila_escolhas?: unknown[] }>(
    escala: T | null,
    user: AuthenticatedUser,
  ): T | null {
    if (!escala || user.role !== Role.OFICIAL || !escala.fila_escolhas) {
      return escala;
    }
    return {
      ...escala,
      fila_escolhas: escala.fila_escolhas.map((item) => {
        const registro = { ...(item as Record<string, unknown>) };
        Reflect.deleteProperty(registro, 'justificativa_inaptidao');
        return registro;
      }),
    };
  }

  @Get()
  async findAll(
    @Query('mes') mes: string | undefined,
    @Query('ano') ano: string | undefined,
    @Query('obm') obm: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const escalas = await this.escalaService.findAll(
      mes ? Number(mes) : undefined,
      ano ? Number(ano) : undefined,
      user.role === Role.ADMIN_MASTER ? obm : this.obmDoUsuario(user),
      user.role === Role.ADMINISTRADOR || user.role === Role.ADMIN_MASTER,
    );
    return escalas.map((escala) =>
      this.ocultarJustificativasDeInaptidao(escala, user),
    );
  }

  @Post('preparar')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  async preparar(
    @Body() dto: PrepararEscalaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const obm = user.role === Role.ADMIN_MASTER
      ? dto.escala.obm
      : this.obmDoUsuario(user);
    await this.unidadeService.validarAtiva(obm);
    return this.preparacaoEscalaService.preparar(dto, obm);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const escala = await this.escalaService.findOne(
      +id,
      user.role === Role.ADMIN_MASTER ? undefined : this.obmDoUsuario(user),
      user.role === Role.ADMINISTRADOR || user.role === Role.ADMIN_MASTER,
    );
    return this.ocultarJustificativasDeInaptidao(escala, user);
  }

  @Patch(':id')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  update(
    @Param('id') id: string,
    @Body() updateEscalaDto: UpdateEscalaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updateWithoutObm = { ...updateEscalaDto };
    Reflect.deleteProperty(updateWithoutObm, 'obm');
    return this.escalaService.update(
      +id,
      user.role === Role.ADMIN_MASTER ? updateEscalaDto : updateWithoutObm,
      user.role === Role.ADMIN_MASTER ? undefined : this.obmDoUsuario(user),
    );
  }

  @Delete(':id')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.escalaService.remove(
      +id,
      user.role === Role.ADMIN_MASTER ? undefined : this.obmDoUsuario(user),
    );
  }
}
