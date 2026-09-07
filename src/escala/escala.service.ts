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
    // Se a lista de serviços não foi enviada ou está vazia, geramos o mês inteiro automaticamente
    if (!createEscalaDto.servicos || createEscalaDto.servicos.length === 0) {
      const { mes, ano } = createEscalaDto;
      const totalDias = new Date(ano, mes, 0).getDate(); // Descobre o último dia do mês (ex: 30 para setembro)
      const servicosGerados: any[] = [];

      for (let dia = 1; dia <= totalDias; dia++) {
        const diaStr = dia.toString().padStart(2, '0');
        const mesStr = mes.toString().padStart(2, '0');
        const dataServico = `${ano}-${mesStr}-${diaStr}`;

        servicosGerados.push({
          data_servico: dataServico,
          // oficial_dia e oficial_sobreaviso não são enviados, logo salvam como null no banco
        });
      }
      
      createEscalaDto.servicos = servicosGerados;
    }

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