import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePermutaDto {
  @IsInt()
  servicoId!: number;

  @IsIn(['DIA', 'SOBREAVISO'])
  tipoVaga!: 'DIA' | 'SOBREAVISO';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  justificativa?: string;

  @IsOptional()
  @IsInt()
  servicoOferecidoId?: number;

  @IsOptional()
  @IsIn(['DIA', 'SOBREAVISO'])
  tipoVagaOferecida?: 'DIA' | 'SOBREAVISO';
}
