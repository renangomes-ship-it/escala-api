import { IsIn, IsInt, IsOptional } from 'class-validator';

export class TrocaAdministrativaDto {
  @IsInt()
  servicoId!: number;

  @IsIn(['DIA', 'SOBREAVISO'])
  tipoVaga!: 'DIA' | 'SOBREAVISO';

  @IsOptional()
  @IsInt()
  sainteId!: number | null;

  @IsOptional()
  @IsInt()
  entranteId!: number | null;
}
