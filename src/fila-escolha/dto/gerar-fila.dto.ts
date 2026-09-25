import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CotasFilaDto {
  @IsInt()
  @Min(0)
  pretas!: number;

  @IsInt()
  @Min(0)
  roxas!: number;

  @IsInt()
  @Min(0)
  vermelhas!: number;
}

export class ItemFilaDto {
  @IsInt()
  oficialId!: number;

  @IsBoolean()
  apto!: boolean;

  @ValidateIf((item: ItemFilaDto) => !item.apto)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  justificativaInaptidao?: string;

  @ValidateNested()
  @Type(() => CotasFilaDto)
  cotas!: CotasFilaDto;
}

export class GerarFilaDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ItemFilaDto)
  dadosFila!: ItemFilaDto[];
}
