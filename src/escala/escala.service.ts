import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEscalaDto } from './dto/create-escala.dto';
import { UpdateEscalaDto } from './dto/update-escala.dto';
import { Escala } from './entities/escala.entity';

@Injectable()
export class EscalaService {
  constructor(
    @InjectRepository(Escala)
    private escalaRepository: Repository<Escala>,
  ) {}

  async create(createEscalaDto: CreateEscalaDto) {
    const novaEscala = this.escalaRepository.create(createEscalaDto);
    return await this.escalaRepository.save(novaEscala);
  }

  async findAll(mes?: number, ano?: number, obm?: string) {
    const filtros: any = {};
    if (mes) filtros.mes = mes;
    if (ano) filtros.ano = ano;
    if (obm) filtros.obm = obm;

    return await this.escalaRepository.find({
      where: filtros,
      relations: {
        servicos: {
          oficial_dia: true,
          oficial_sobreaviso: true,
        },
      },
    });
  }

  async findOne(id: number) {
    return await this.escalaRepository.findOne({
      where: { id },
      relations: {
        servicos: {
          oficial_dia: true,
          oficial_sobreaviso: true,
        },
      },
    });
  }

  async update(id: number, updateEscalaDto: UpdateEscalaDto) {
    await this.escalaRepository.update(id, updateEscalaDto);
    return await this.findOne(id);
  }

  async remove(id: number) {
    await this.escalaRepository.delete(id);
    return { mensagem: `Escala com ID ${id} removida com sucesso.` };
  }
}