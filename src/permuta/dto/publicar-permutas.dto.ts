import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class PublicarPermutasDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  permutaIds!: number[];

  @IsString()
  @IsNotEmpty()
  boletim!: string;
}
