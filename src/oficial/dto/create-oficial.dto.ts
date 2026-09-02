import { IsString, IsNotEmpty } from 'class-validator';

export class CreateOficialDto {
  
  @IsString({ message: 'O nome deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O nome do oficial não pode ficar em branco.' })
  nome: string;

  @IsString({ message: 'O posto/graduação deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O posto/graduação não pode ficar em branco.' })
  posto_graduacao: string;
}