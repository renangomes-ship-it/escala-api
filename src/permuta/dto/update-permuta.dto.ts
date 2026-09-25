import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePermutaDto {
  @IsIn(['SIM', 'NAO'])
  acao!: 'SIM' | 'NAO';

  @IsOptional()
  @IsString()
  justificativa?: string;
}
