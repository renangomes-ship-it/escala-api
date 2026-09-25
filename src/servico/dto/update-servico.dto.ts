import { PartialType } from '@nestjs/mapped-types';
import { CreateServicoDto } from './create-servico.dto';
import { IsIn, IsOptional } from 'class-validator';

export class UpdateServicoDto extends PartialType(CreateServicoDto) {
  @IsOptional()
  @IsIn(['PRETA', 'ROXA', 'VERMELHA'])
  tipo_escala?: 'PRETA' | 'ROXA' | 'VERMELHA';
}
