import { PartialType } from '@nestjs/mapped-types';
import { CreateOficialDto } from './create-oficial.dto';

export class UpdateOficialDto extends PartialType(CreateOficialDto) {}
