import { PartialType } from '@nestjs/mapped-types';
import { CreatePermutaDto } from './create-permuta.dto';

export class UpdatePermutaDto extends PartialType(CreatePermutaDto) {}
