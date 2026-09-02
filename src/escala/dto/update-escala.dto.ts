import { PartialType } from '@nestjs/mapped-types';
import { CreateEscalaDto } from './create-escala.dto';

export class UpdateEscalaDto extends PartialType(CreateEscalaDto) {}
