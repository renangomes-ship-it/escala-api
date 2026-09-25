import { IsString, IsEmail, IsNotEmpty, MinLength, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { Role } from '../entities/oficial.entity';

export class CreateOficialDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsString()
  @IsNotEmpty()
  posto_graduacao!: string;

  @IsDateString({}, { message: 'A data da última promoção deve ser uma data válida.' })
  data_ultima_promocao!: string;

  @IsString()
  @IsNotEmpty()
  rg!: string;

  @IsEmail({}, { message: 'O email deve ser um endereço de e-mail válido.' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  senha!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  obm?: string;
}
