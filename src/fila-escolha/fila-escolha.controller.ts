import { Controller, Post, Get, Body, Param, BadRequestException } from '@nestjs/common';
import { FilaEscolhaService } from './fila-escolha.service';

@Controller('fila-escolha')
export class FilaEscolhaController {
  constructor(private readonly filaEscolhaService: FilaEscolhaService) {}

  @Post('gerar/:escalaId')
  async gerarFila(
    @Param('escalaId') escalaId: string,
    @Body('oficiaisIds') oficiaisIds: number[],
  ) {
    return await this.filaEscolhaService.gerarFila(+escalaId, oficiaisIds);
  }

  // GET /fila-escolha/status/5 -> Retorna o raio-x da fila
  @Get('status/:escalaId')
  async obterStatus(@Param('escalaId') escalaId: string) {
    return await this.filaEscolhaService.obterFilaPorEscala(+escalaId);
  }

  // PATCH /fila-escolha/passar-turno/5 -> Pula o atual e avança para o próximo
  @Post('passar-turno/:escalaId')
  async passarTurno(@Param('escalaId') escalaId: string) {
    return await this.filaEscolhaService.passarTurno(+escalaId);
  }

  @Post('registrar-vaga')
  async registrarVaga(
    @Body() body: { escalaId: number; oficialId: number; servicoId: number; tipoVaga: 'DIA' | 'SOBREAVISO' }
  ) {
    if (!body.escalaId || !body.oficialId || !body.servicoId || !body.tipoVaga) {
      throw new BadRequestException('Parâmetros incompletos. Envie escalaId, oficialId, servicoId e tipoVaga.');
    }

    return await this.filaEscolhaService.registrarEscolhaVaga(
      body.escalaId, 
      body.oficialId, 
      body.servicoId, 
      body.tipoVaga
    );
  }

  // POST /fila-escolha/finalizar
  @Post('finalizar')
  async finalizarTurno(
    @Body() body: { escalaId: number; oficialId: number }
  ) {
    if (!body.escalaId || !body.oficialId) {
      throw new BadRequestException('Parâmetros incompletos. Envie escalaId e oficialId.');
    }

    return await this.filaEscolhaService.finalizarTurno(body.escalaId, body.oficialId);
  }
}