import { IsNotEmpty, IsString } from 'class-validator';

export class ValidatePasswordDto {
  @IsString()
  @IsNotEmpty()
  senha!: string;
}
