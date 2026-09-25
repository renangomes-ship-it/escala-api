import { IsBoolean } from 'class-validator';

export class UpdateUnidadeDto {
  @IsBoolean()
  ativo!: boolean;
}
