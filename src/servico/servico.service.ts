import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateServicoDto } from './dto/create-servico.dto';
import { UpdateServicoDto } from './dto/update-servico.dto';
import { Servico } from './entities/servico.entity';

@Injectable()
export class ServicoService {
  constructor(
    @InjectRepository(Servico)
    private servicoRepository: Repository<Servico>,
  ) {}

  async create(createServicoDto: CreateServicoDto) {
    // TRAVA: Impede o mesmo oficial de acumular as duas funções no mesmo plantão
    if (createServicoDto.oficial_dia_id === createServicoDto.oficial_sobreaviso_id) {
      throw new BadRequestException('O mesmo oficial não pode ser escalado como Oficial de Dia e Sobreaviso no mesmo plantão.');
    }

    const novoServico = this.servicoRepository.create({
      data_servico: createServicoDto.data_servico,
      escala: { id: createServicoDto.escala_id },
      oficial_dia: { id: createServicoDto.oficial_dia_id },
      oficial_sobreaviso: { id: createServicoDto.oficial_sobreaviso_id }
    });
    
    return await this.servicoRepository.save(novoServico);
  }

  async findAll() {
    return await this.servicoRepository.find();
  }

  async findOne(id: number) {
    return await this.servicoRepository.findOneBy({ id });
  }

  async update(id: number, updateServicoDto: UpdateServicoDto) {
    await this.servicoRepository.update(id, updateServicoDto);
    return await this.servicoRepository.findOneBy({ id });
  }

  async remove(id: number) {
    await this.servicoRepository.delete(id);
    return { mensagem: `Serviço com ID ${id} removido com sucesso.` };
  }
}