import { PartialType } from '@nestjs/mapped-types';
import { CreateOficialDto } from './create-oficial.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOficialDto extends PartialType(CreateOficialDto) {
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
