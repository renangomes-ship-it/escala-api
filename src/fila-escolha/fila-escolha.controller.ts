import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { FilaEscolhaService } from './fila-escolha.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../oficial/entities/oficial.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { VagaFilaDto } from './dto/vaga-fila.dto';
import {
  FinalizarEscolhaManualDto,
  FinalizarTurnoDto,
} from './dto/finalizar-turno.dto';

@Controller('fila-escolha')
export class FilaEscolhaController {
  constructor(private readonly filaEscolhaService: FilaEscolhaService) {}

  private obmDaEscala(user: AuthenticatedUser): string | undefined {
    if (user.role === Role.ADMIN_MASTER) {
      return undefined;
    }
    if (!user.obm) {
      throw new ForbiddenException('O usuário autenticado não possui uma OBM vinculada.');
    }
    return user.obm;
  }

  // GET /fila-escolha/status/5 -> Retorna o raio-x da fila
  @Get('status/:escalaId')
  async obterStatus(
    @Param('escalaId') escalaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const status = await this.filaEscolhaService.obterFilaPorEscala(
      +escalaId,
      this.obmDaEscala(user),
    );
    if (user.role !== Role.OFICIAL) return status;
    return {
      ...status,
      progresso: status.progresso.map((item) => {
        const registro = { ...item };
        Reflect.deleteProperty(registro, 'justificativa_inaptidao');
        return registro;
      }),
    };
  }

  // PATCH /fila-escolha/passar-turno/5 -> Pula o atual e avança para o próximo
  @Post('passar-turno/:escalaId')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  async passarTurno(
    @Param('escalaId') escalaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.filaEscolhaService.passarTurno(
      +escalaId,
      this.obmDaEscala(user),
    );
  }

  // POST /fila-escolha/reivindicar/5/10 -> Oficial pulado rouba a vez
  @Post('reivindicar/:escalaId')
  async reivindicarVez(
    @Param('escalaId') escalaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.filaEscolhaService.reivindicarVez(
      +escalaId,
      user.id,
      this.obmDaEscala(user),
    );
  }

  @Post('registrar-vaga')
  async registrarVaga(
    @Body() body: VagaFilaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body.escalaId || !body.servicoId || !body.tipoVaga) {
      throw new BadRequestException('Parâmetros incompletos. Envie escalaId, servicoId e tipoVaga.');
    }

    return await this.filaEscolhaService.registrarEscolhaVaga(
      body.escalaId, 
      user.id,
      body.servicoId, 
      body.tipoVaga,
      this.obmDaEscala(user),
    );
  }

  // POST /fila-escolha/finalizar
  @Post('finalizar')
  async finalizarTurno(
    @Body() body: FinalizarTurnoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body.escalaId) {
      throw new BadRequestException('O ID da escala é obrigatório.');
    }

    return await this.filaEscolhaService.finalizarTurno(
      body.escalaId,
      user.id,
      this.obmDaEscala(user),
    );
  }

  @Post('remover-vaga')
  async removerVaga(
    @Body() body: VagaFilaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.filaEscolhaService.removerEscolhaVaga(
      body.escalaId,
      user.id,
      body.servicoId,
      body.tipoVaga,
      this.obmDaEscala(user),
    );
  }

  @Post('finalizar-manualmente')
  @Roles(Role.ESCALANTE, Role.ADMIN_MASTER)
  async finalizarEscolhaManual(
    @Body() body: FinalizarEscolhaManualDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body.escalaId || !body.oficialId) {
      throw new BadRequestException('Os IDs da escala e do oficial são obrigatórios.');
    }
    return this.filaEscolhaService.finalizarEscolhaManual(
      body.escalaId,
      body.oficialId,
      this.obmDaEscala(user),
    );
  }
}
