import { IsInt } from 'class-validator';

export class FinalizarTurnoDto {
  @IsInt()
  escalaId!: number;
}

export class FinalizarEscolhaManualDto extends FinalizarTurnoDto {
  @IsInt()
  oficialId!: number;
}
