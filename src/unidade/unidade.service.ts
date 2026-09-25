import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unidade } from './entities/unidade.entity';

@Injectable()
export class UnidadeService {
  constructor(
    @InjectRepository(Unidade)
    private unidadeRepository: Repository<Unidade>,
  ) {}

  findAll(incluirInativas = false) {
    return this.unidadeRepository.find({
      where: incluirInativas ? {} : { ativo: true },
      order: { id: 'ASC' },
    });
  }

  async validarAtiva(sigla: string): Promise<void> {
    const unidade = await this.unidadeRepository.findOne({
      where: { sigla, ativo: true },
    });
    if (!unidade) {
      throw new BadRequestException('A unidade informada não existe ou está inativa.');
    }
  }

  async update(id: number, ativo: boolean) {
    const result = await this.unidadeRepository.update({ id }, { ativo });
    if (!result.affected) {
      throw new NotFoundException('Unidade não encontrada.');
    }
    return this.unidadeRepository.findOneBy({ id });
  }
}
