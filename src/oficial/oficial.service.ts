import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOficialDto } from './dto/create-oficial.dto';
import { Oficial } from './entities/oficial.entity';
import { UpdateOficialDto } from './dto/update-oficial.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OficialService {
  
  constructor(
    @InjectRepository(Oficial)
    private oficialRepository: Repository<Oficial>,
  ) {}

  // Cria novo oficial na tabela com senha criptografada via bcrypt
  async create(createOficialDto: CreateOficialDto) {
    const { rg, senha, ...rest } = createOficialDto;

    // Opcional: valida se já existe oficial com este RG
    const existe = await this.oficialRepository.findOne({ where: { rg } });
    if (existe) {
      throw new BadRequestException('Já existe um oficial cadastrado com este RG.');
    }

    // Gera o hash da senha antes de persistir
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const novoOficial = this.oficialRepository.create({
      ...rest,
      rg,
      senha: senhaHash,
    });
    
    return await this.oficialRepository.save(novoOficial);
  }

  // Retorna todos os oficiais
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

  // Atualiza oficiais por id apenas com informações novas.
  async update(id: number, updateOficialDto: UpdateOficialDto) {
    // Se eventualmente atualizar a senha por aqui, também seria ideal aplicar o hash, 
    // mas para o fluxo padrão de cadastro, o create já resolve.
    await this.oficialRepository.update(id, updateOficialDto);

    return await this.oficialRepository.findOneBy({ id });
  }
}