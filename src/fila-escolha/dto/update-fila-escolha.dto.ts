import { PartialType } from '@nestjs/mapped-types';
import { CreateFilaEscolhaDto } from './create-fila-escolha.dto';

export class UpdateFilaEscolhaDto extends PartialType(CreateFilaEscolhaDto) {}
