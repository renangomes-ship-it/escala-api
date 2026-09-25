import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AlterarSenhaDto {
  @IsString()
  @IsNotEmpty()
  senhaAtual!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'A nova senha deve ter no mínimo 8 caracteres.' })
  novaSenha!: string;

  @IsString()
  @IsNotEmpty()
  confirmacaoNovaSenha!: string;
}
