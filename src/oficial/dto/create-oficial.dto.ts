import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateOficialDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsString()
  @IsNotEmpty()
  posto_graduacao!: string;

  @IsString()
  @IsNotEmpty()
  rg!: string;

  @IsEmail({}, { message: 'O email deve ser um endereço de e-mail válido.' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  senha!: string;
}