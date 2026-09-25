import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { ItemFilaDto } from '../../fila-escolha/dto/gerar-fila.dto';
import { CreateEscalaDto } from './create-escala.dto';

export class PrepararEscalaDto {
  @ValidateNested()
  @Type(() => CreateEscalaDto)
  escala!: CreateEscalaDto;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ItemFilaDto)
  dadosFila!: ItemFilaDto[];
}
