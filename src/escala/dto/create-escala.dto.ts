import { IsNumber, IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateEscalaDto {
  @IsNumber({}, { message: 'O mês deve ser um número (ex: 10).' })
  @IsNotEmpty({ message: 'O mês é obrigatório.' })
  mes: number;

  @IsNumber({}, { message: 'O ano deve ser um número (ex: 2026).' })
  @IsNotEmpty({ message: 'O ano é obrigatório.' })
  ano: number;

  @IsString({ message: 'A OBM deve ser um texto válido.' })
  @IsNotEmpty({ message: 'A OBM (Quartel) é obrigatória.' })
  obm: string;

  @IsOptional()
  @IsArray({ message: 'Os serviços devem estar em formato de lista.' })
  servicos?: any[];
}