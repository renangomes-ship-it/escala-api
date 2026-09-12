import { Controller, Post, Get, Body, Param, Patch } from '@nestjs/common';
import { PermutaService } from './permuta.service';

@Controller('permuta')
export class PermutaController {
  constructor(private readonly permutaService: PermutaService) {}

  @Post('solicitar')
  solicitar(@Body() body: { servicoId: number, tipoVaga: 'DIA'|'SOBREAVISO', sainteId: number, entranteId: number, justificativa?: string }) {
    return this.permutaService.solicitarPermuta(body);
  }

  @Post('administrativa')
  trocaAdministrativa(@Body() body: { servicoId: number, tipoVaga: 'DIA'|'SOBREAVISO', sainteId: number | null, entranteId: number | null }) {
    return this.permutaService.trocaAdministrativa(body);
  }

  @Patch(':id/responder')
  responder(@Param('id') id: string, @Body() body: { acao: 'SIM' | 'NAO', respondidoPor: 'OFICIAL_ENVOLVIDO' | 'ESCALANTE', justificativa?: string }) {
    return this.permutaService.responderPermuta(+id, body.acao, body.respondidoPor, body.justificativa);
  }

  @Get()
  findAll() {
    return this.permutaService.findAll();
  }

  @Patch('publicar')
  publicarEmLote(@Body() body: { permutaIds: number[], boletim: string }) {
    return this.permutaService.publicarPermutas(body.permutaIds, body.boletim);
  }
}