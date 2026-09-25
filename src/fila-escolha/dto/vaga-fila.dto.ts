import { IsIn, IsInt } from 'class-validator';

export class VagaFilaDto {
  @IsInt()
  escalaId!: number;

  @IsInt()
  servicoId!: number;

  @IsIn(['DIA', 'SOBREAVISO'])
  tipoVaga!: 'DIA' | 'SOBREAVISO';
}
