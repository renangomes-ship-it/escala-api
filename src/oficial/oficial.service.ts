import { Injectable } from '@nestjs/common';
import { CreateOficialDto } from './dto/create-oficial.dto';
import { UpdateOficialDto } from './dto/update-oficial.dto';

@Injectable()
export class OficialService {
  create(createOficialDto: CreateOficialDto) {
    return 'This action adds a new oficial';
  }

  findAll() {
    return `This action returns all oficial`;
  }

  findOne(id: number) {
    return `This action returns a #${id} oficial`;
  }

  update(id: number, updateOficialDto: UpdateOficialDto) {
    return `This action updates a #${id} oficial`;
  }

  remove(id: number) {
    return `This action removes a #${id} oficial`;
  }
}
