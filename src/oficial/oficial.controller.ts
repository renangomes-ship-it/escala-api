import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OficialService } from './oficial.service';
import { CreateOficialDto } from './dto/create-oficial.dto';
import { UpdateOficialDto } from './dto/update-oficial.dto';

@Controller('oficial')
export class OficialController {
  constructor(private readonly oficialService: OficialService) {}

  @Post()
  create(@Body() createOficialDto: CreateOficialDto) {
    return this.oficialService.create(createOficialDto);
  }

  @Get()
  findAll() {
    return this.oficialService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.oficialService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOficialDto: UpdateOficialDto) {
    return this.oficialService.update(+id, updateOficialDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.oficialService.remove(+id);
  }
}
