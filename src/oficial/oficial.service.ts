import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOficialDto } from './dto/create-oficial.dto';
import { Oficial } from './entities/oficial.entity';
import { UpdateOficialDto } from './dto/update-oficial.dto';

@Injectable()
export class OficialService {
  
  constructor(
    @InjectRepository(Oficial)
    private oficialRepository: Repository<Oficial>,
  ) {}

  //Cria novo oficial na tabela
  async create(createOficialDto: CreateOficialDto) {
    const novoOficial = this.oficialRepository.create(createOficialDto);
    
    return await this.oficialRepository.save(novoOficial);
  }

  //Retorna todos os oficiais
  async findAll() {
    return await this.oficialRepository.find();
  }

  // Busca um oficial pelo ID
  async findOne(id: number) {
    return await this.oficialRepository.findOneBy({ id });
  }

  // Deleta pelo ID
  async remove(id: number) {
    await this.oficialRepository.delete(id);
    
    return { mensagem: `Oficial com ID ${id} removido com sucesso da base de dados.` };
  }

  // Atualiza oficias por id apenas com informações novas.
  async update(id: number, updateOficialDto: UpdateOficialDto) {
    await this.oficialRepository.update(id, updateOficialDto);

    return await this.oficialRepository.findOneBy({ id });
  }
}