import { Controller, Post, Get, Body, Param, BadRequestException } from '@nestjs/common';
import { FilaEscolhaService } from './fila-escolha.service';

@Controller('fila-escolha')
export class FilaEscolhaController {
  constructor(private readonly filaEscolhaService: FilaEscolhaService) {}

  @Post('gerar/:escalaId')
  async gerarFila(
    @Param('escalaId') escalaId: string,
    @Body('dadosFila') dadosFila: any[],
  ) {
    return await this.filaEscolhaService.gerarFila(+escalaId, dadosFila);
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

  // POST /fila-escolha/reivindicar/5/10 -> Oficial pulado rouba a vez
  @Post('reivindicar/:escalaId/:oficialId')
  async reivindicarVez(
    @Param('escalaId') escalaId: string,
    @Param('oficialId') oficialId: string,
  ) {
    return await this.filaEscolhaService.reivindicarVez(+escalaId, +oficialId);
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

  @Post('remover-vaga')
  async removerVaga(@Body() body: { escalaId: number; oficialId: number; servicoId: number; tipoVaga: 'DIA' | 'SOBREAVISO' }) {
    return await this.filaEscolhaService.removerEscolhaVaga(body.escalaId, body.oficialId, body.servicoId, body.tipoVaga);
  }
}