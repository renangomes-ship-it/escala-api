import { IsIn, IsInt } from 'class-validator';

export class RealocarAdministrativaDto {
  @IsInt()
  servicoOrigemId!: number;

  @IsInt()
  servicoDestinoId!: number;

  @IsIn(['DIA', 'SOBREAVISO'])
  tipoVaga!: 'DIA' | 'SOBREAVISO';

  @IsInt()
  oficialId!: number;
}
