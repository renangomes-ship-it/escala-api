import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ServicoDaEscalaDto {
  @IsDateString()
  data_servico!: string;

  @IsIn(['PRETA', 'ROXA', 'VERMELHA'])
  tipo_escala!: 'PRETA' | 'ROXA' | 'VERMELHA';
}

export class CreateEscalaDto {
  @IsInt({ message: 'O mês deve ser um número inteiro (ex: 10).' })
  @Min(1)
  @Max(12)
  @IsNotEmpty({ message: 'O mês é obrigatório.' })
  mes: number;

  @IsInt({ message: 'O ano deve ser um número inteiro (ex: 2026).' })
  @Min(2000)
  @Max(2200)
  @IsNotEmpty({ message: 'O ano é obrigatório.' })
  ano: number;

  @IsString({ message: 'A OBM deve ser um texto válido.' })
  @IsNotEmpty({ message: 'A OBM (Quartel) é obrigatória.' })
  obm: string;

  @IsOptional()
  @IsArray({ message: 'Os serviços devem estar em formato de lista.' })
  @ValidateNested({ each: true })
  @Type(() => ServicoDaEscalaDto)
  servicos?: ServicoDaEscalaDto[];
}
