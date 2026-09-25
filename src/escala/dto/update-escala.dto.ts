import { PartialType } from '@nestjs/mapped-types';
import { CreateEscalaDto } from './create-escala.dto';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateEscalaDto extends PartialType(CreateEscalaDto) {
  @IsOptional()
  @IsIn(['ABERTA', 'PENDENTE_AJUSTE_MANUAL', 'FECHADA', 'PUBLICADA', 'ARQUIVADA'])
  status?: 'ABERTA' | 'PENDENTE_AJUSTE_MANUAL' | 'FECHADA' | 'PUBLICADA' | 'ARQUIVADA';

  @IsOptional()
  @IsString()
  boletim_interno?: string;
}
