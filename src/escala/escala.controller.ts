import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { EscalaService } from './escala.service';
import { CreateEscalaDto } from './dto/create-escala.dto';
import { UpdateEscalaDto } from './dto/update-escala.dto';

@Controller('escala')
export class EscalaController {
  constructor(private readonly escalaService: EscalaService) {}

  @Post()
  create(@Body() createEscalaDto: CreateEscalaDto) {
    return this.escalaService.create(createEscalaDto);
  }

  @Get()
  findAll(
    @Query('mes') mes?: string,
    @Query('ano') ano?: string,
    @Query('obm') obm?: string,
  ) {
    return this.escalaService.findAll(
      mes ? Number(mes) : undefined,
      ano ? Number(ano) : undefined,
      obm,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.escalaService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEscalaDto: UpdateEscalaDto) {
    return this.escalaService.update(+id, updateEscalaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.escalaService.remove(+id);
  }
}