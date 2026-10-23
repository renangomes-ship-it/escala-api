import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  ForbiddenException,
} from '@nestjs/common';
import { PermutaService } from './permuta.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../oficial/entities/oficial.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreatePermutaDto } from './dto/create-permuta.dto';
import { UpdatePermutaDto } from './dto/update-permuta.dto';
import { TrocaAdministrativaDto } from './dto/troca-administrativa.dto';
import { PublicarPermutasDto } from './dto/publicar-permutas.dto';
import { AjustarEscolhaDto } from './dto/ajustar-escolha.dto';
import { RealocarAdministrativaDto } from './dto/realocar-administrativa.dto';

@Controller('permuta')
export class PermutaController {
  constructor(private readonly permutaService: PermutaService) {}

  private obmDoUsuario(user: AuthenticatedUser): string | undefined {
    if (user.role === Role.ADMIN_MASTER) {
      return undefined;
    }
    if (!user.obm) {
      throw new ForbiddenException(
        'O usuário autenticado não possui uma OBM vinculada.',
      );
    }
    return user.obm;
  }

  @Post('solicitar')
  solicitar(
    @Body() body: CreatePermutaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permutaService.solicitarPermuta(
      { ...body, entranteId: user.id },
      this.obmDoUsuario(user),
    );
  }

  @Post('ajustar-escolha')
  ajustarEscolha(
    @Body() body: AjustarEscolhaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permutaService.ajustarEscolha(
      body,
      user.id,
      this.obmDoUsuario(user),
    );
  }

  @Post('administrativa')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  trocaAdministrativa(
    @Body() body: TrocaAdministrativaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permutaService.trocaAdministrativa(
      body,
      this.obmDoUsuario(user),
    );
  }

  @Post('realocar-administrativa')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  realocarAdministrativamente(
    @Body() body: RealocarAdministrativaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permutaService.realocarAdministrativamente(
      body,
      this.obmDoUsuario(user),
    );
  }

  @Patch(':id/responder')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  responder(
    @Param('id') id: string,
    @Body() body: UpdatePermutaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permutaService.responderPermuta(
      +id,
      body.acao,
      'ESCALANTE',
      body.justificativa,
      this.obmDoUsuario(user),
    );
  }

  @Patch(':id/responder-oficial')
  responderComoOficial(
    @Param('id') id: string,
    @Body() body: UpdatePermutaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permutaService.responderComoOficial(
      +id,
      user.id,
      body.acao,
      body.justificativa,
      this.obmDoUsuario(user),
    );
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    if (user.role === Role.OFICIAL) {
      return this.permutaService.findByOficial(
        user.id,
        this.obmDoUsuario(user),
      );
    }
    return this.permutaService.findAll(this.obmDoUsuario(user));
  }

  @Patch('publicar')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  publicarEmLote(
    @Body() body: PublicarPermutasDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permutaService.publicarPermutas(
      body.permutaIds,
      body.boletim,
      this.obmDoUsuario(user),
    );
  }
}
