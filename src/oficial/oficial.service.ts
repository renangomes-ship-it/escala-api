import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOficialDto } from './dto/create-oficial.dto';
import { Oficial } from './entities/oficial.entity';
import { UpdateOficialDto } from './dto/update-oficial.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OficialService {
  private readonly pesoPosto: Record<string, number> = {
    Coronel: 7,
    'Tenente-Coronel': 6,
    Major: 5,
    'Capitão': 4,
    '1º Tenente': 3,
    '2º Tenente': 2,
    Aspirante: 1,
  };

  constructor(
    @InjectRepository(Oficial)
    private oficialRepository: Repository<Oficial>,
  ) {}

  // Cria novo oficial na tabela com senha criptografada via bcrypt
  async create(createOficialDto: CreateOficialDto) {
    const { rg, email, senha, ...rest } = createOficialDto;

    const existe = await this.oficialRepository.findOne({ where: [{ rg }, { email }] });
    if (existe) {
      throw new BadRequestException(
        existe.rg === rg
          ? 'Já existe um oficial cadastrado com este RG.'
          : 'Já existe um oficial cadastrado com este e-mail.',
      );
    }

    // Gera o hash da senha antes de persistir
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const novoOficial = this.oficialRepository.create({
      ...rest,
      rg,
      email,
      senha: senhaHash,
      deve_alterar_senha: true,
      versao_autenticacao: 0,
    });

    const salvo = await this.oficialRepository.save(novoOficial);
    const { senha: _senha, ...oficialSeguro } = salvo;
    return oficialSeguro;
  }

  async findAll(obm?: string | null, somenteAtivos = false) {
    const oficiais = await this.oficialRepository.find({
      where: { ...(obm ? { obm } : {}), ...(somenteAtivos ? { ativo: true } : {}) },
    });

    return oficiais.sort((a, b) => {
      const diferencaPosto = (this.pesoPosto[b.posto_graduacao] ?? 0) -
        (this.pesoPosto[a.posto_graduacao] ?? 0);
      if (diferencaPosto !== 0) return diferencaPosto;

      if (a.data_ultima_promocao && b.data_ultima_promocao) {
        const diferencaPromocao = a.data_ultima_promocao.localeCompare(b.data_ultima_promocao);
        if (diferencaPromocao !== 0) return diferencaPromocao;
      } else if (a.data_ultima_promocao) {
        return -1;
      } else if (b.data_ultima_promocao) {
        return 1;
      }

      return a.rg.localeCompare(b.rg, 'pt-BR', { numeric: true });
    });
  }

  // Busca um oficial pelo ID
  async findOne(id: number, obm?: string | null) {
    return await this.oficialRepository.findOneBy({ id, ...(obm ? { obm } : {}) });
  }

  // Preserva o histórico e apenas retira o oficial das próximas escalas.
  async remove(id: number, obm?: string | null) {
    const result = await this.oficialRepository.update(
      { id, ...(obm ? { obm } : {}) },
      { ativo: false },
    );
    if (!result.affected) {
      throw new NotFoundException('Oficial não encontrado.');
    }
    
    return { mensagem: `Oficial com ID ${id} foi inativado com sucesso.` };
  }

  // Atualiza oficiais por id apenas com informações novas.
  async update(
    id: number,
    updateOficialDto: UpdateOficialDto,
    obm?: string | null,
    senhaTemporaria = false,
  ) {
    const { senha, ...dados } = updateOficialDto;
    if (dados.rg || dados.email) {
      const duplicado = await this.oficialRepository.findOne({
        where: [
          ...(dados.rg ? [{ rg: dados.rg }] : []),
          ...(dados.email ? [{ email: dados.email }] : []),
        ],
      });
      if (duplicado && duplicado.id !== id) {
        throw new BadRequestException(
          dados.rg && duplicado.rg === dados.rg
            ? 'Já existe um oficial cadastrado com este RG.'
            : 'Já existe um oficial cadastrado com este e-mail.',
        );
      }
    }

    const update: Partial<Oficial> = { ...dados };
    if (senha) {
      const atual = await this.oficialRepository.findOneBy({
        id,
        ...(obm ? { obm } : {}),
      });
      if (!atual) {
        throw new NotFoundException('Oficial não encontrado.');
      }
      update.senha = await bcrypt.hash(senha, 10);
      update.deve_alterar_senha = senhaTemporaria;
      update.versao_autenticacao = (atual.versao_autenticacao ?? 0) + 1;
    }

    const result = await this.oficialRepository.update(
      { id, ...(obm ? { obm } : {}) },
      update,
    );
    if (!result.affected) {
      throw new NotFoundException('Oficial não encontrado.');
    }

    return await this.findOne(id, obm);
  }
}
