import { IsDateString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateServicoDto {
  @IsDateString({}, { message: 'A data do serviço deve estar no formato YYYY-MM-DD (Ex: 2026-09-01).' })
  @IsNotEmpty({ message: 'A data do serviço é obrigatória.' })
  data_servico: string;

  @IsNumber({}, { message: 'Informe o ID da escala (capa).' })
  @IsNotEmpty()
  escala_id: number;

  @IsNumber({}, { message: 'Informe o ID do Oficial de Dia/Operações.' })
  @IsNotEmpty()
  oficial_dia_id: number;

  @IsNumber({}, { message: 'Informe o ID do Oficial de Sobreaviso.' })
  @IsNotEmpty()
  oficial_sobreaviso_id: number;
}