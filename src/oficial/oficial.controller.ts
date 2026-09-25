import { Controller, Get, Post, Body, Param, Delete, Patch, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from './entities/oficial.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { OficialService } from './oficial.service';
import { CreateOficialDto } from './dto/create-oficial.dto';
import { UpdateOficialDto } from './dto/update-oficial.dto';
import { UnidadeService } from '../unidade/unidade.service';

@Controller('oficial')
@Roles(Role.ADMINISTRADOR, Role.ADMIN_MASTER)
export class OficialController {
  constructor(
    private readonly oficialService: OficialService,
    private readonly unidadeService: UnidadeService,
  ) {}

  private obmDoUsuario(user: AuthenticatedUser): string {
    if (!user.obm) {
      throw new ForbiddenException('O usuário autenticado não possui uma OBM vinculada.');
    }
    return user.obm;
  }

  @Post()
  @Roles(Role.ADMIN_MASTER)
  async create(@Body() createOficialDto: CreateOficialDto, @CurrentUser() user: AuthenticatedUser) {
    const perfil = createOficialDto.role ?? Role.OFICIAL;
    if (perfil !== Role.ADMIN_MASTER && !createOficialDto.obm) {
      throw new BadRequestException('A OBM é obrigatória para este perfil.');
    }
    if (createOficialDto.obm) {
      await this.unidadeService.validarAtiva(createOficialDto.obm);
    }
    return this.oficialService.create(createOficialDto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.oficialService.findAll(
      user.role === Role.ADMIN_MASTER ? undefined : this.obmDoUsuario(user),
    );
  }

  @Get('disponiveis')
  @Roles(Role.OFICIAL, Role.ESCALANTE, Role.ADMINISTRADOR, Role.ADMIN_MASTER)
  findDisponiveis(@CurrentUser() user: AuthenticatedUser) {
    return this.oficialService.findAll(
      user.role === Role.ADMIN_MASTER ? undefined : this.obmDoUsuario(user),
      true,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.oficialService.findOne(
      +id,
      user.role === Role.ADMIN_MASTER ? undefined : this.obmDoUsuario(user),
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (+id === user.id) {
      throw new BadRequestException('Você não pode inativar o próprio usuário conectado.');
    }
    const obm = user.role === Role.ADMIN_MASTER ? undefined : this.obmDoUsuario(user);
    if (user.role === Role.ADMINISTRADOR) {
      const alvo = await this.oficialService.findOne(+id, obm);
      if (!alvo || ![Role.OFICIAL, Role.ESCALANTE].includes(alvo.role)) {
        throw new ForbiddenException('O administrador da unidade só pode gerenciar oficiais e escalantes da própria OBM.');
      }
    }
    return this.oficialService.remove(
      +id,
      obm,
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOficialDto: UpdateOficialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (+id === user.id && updateOficialDto.ativo === false) {
      throw new BadRequestException('Você não pode inativar o próprio usuário conectado.');
    }
    if (+id === user.id && updateOficialDto.role && updateOficialDto.role !== user.role) {
      throw new BadRequestException('Você não pode alterar o próprio perfil de acesso.');
    }
    if (+id === user.id && updateOficialDto.senha) {
      throw new BadRequestException(
        'Use a opção Alterar senha para modificar a própria senha.',
      );
    }
    const obm = user.role === Role.ADMIN_MASTER ? undefined : this.obmDoUsuario(user);
    if (user.role === Role.ADMINISTRADOR) {
      const alvo = await this.oficialService.findOne(+id, obm);
      if (!alvo || ![Role.OFICIAL, Role.ESCALANTE].includes(alvo.role)) {
        throw new ForbiddenException('O administrador da unidade só pode gerenciar oficiais e escalantes da própria OBM.');
      }
      if (updateOficialDto.role && ![Role.OFICIAL, Role.ESCALANTE].includes(updateOficialDto.role)) {
        throw new ForbiddenException('O administrador da unidade só pode alternar entre Oficial e Escalante.');
      }
      const dadosPermitidos: UpdateOficialDto = {};
      if (updateOficialDto.ativo !== undefined) dadosPermitidos.ativo = updateOficialDto.ativo;
      if (updateOficialDto.role !== undefined) dadosPermitidos.role = updateOficialDto.role;
      return this.oficialService.update(+id, dadosPermitidos, obm);
    }

    if (updateOficialDto.obm) {
      await this.unidadeService.validarAtiva(updateOficialDto.obm);
    }

    return this.oficialService.update(
      +id,
      updateOficialDto,
      undefined,
      Boolean(updateOficialDto.senha),
    );
  }
}
