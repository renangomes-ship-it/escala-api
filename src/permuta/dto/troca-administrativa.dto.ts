import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificativa?: string;
}
