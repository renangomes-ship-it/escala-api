import { IsIn, IsInt } from 'class-validator';

export class AjustarEscolhaDto {
  @IsInt()
  servicoOrigemId!: number;

  @IsIn(['DIA', 'SOBREAVISO'])
  tipoVagaOrigem!: 'DIA' | 'SOBREAVISO';

  @IsInt()
  servicoDestinoId!: number;

  @IsIn(['DIA', 'SOBREAVISO'])
  tipoVagaDestino!: 'DIA' | 'SOBREAVISO';
}
