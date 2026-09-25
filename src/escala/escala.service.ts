import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import { CreateEscalaDto } from './dto/create-escala.dto';
import { UpdateEscalaDto } from './dto/update-escala.dto';
import { Escala } from './entities/escala.entity';

@Injectable()
export class EscalaService {
  constructor(
    @InjectRepository(Escala)
    private escalaRepository: Repository<Escala>,
  ) {}

  async create(createEscalaDto: CreateEscalaDto, manager?: EntityManager) {
    const escalaRepository = manager?.getRepository(Escala) ?? this.escalaRepository;
    if (!createEscalaDto.servicos || createEscalaDto.servicos.length === 0) {
      const { mes, ano } = createEscalaDto;
      const totalDias = new Date(ano, mes, 0).getDate();
      const servicosGerados: any[] = [];

      for (let dia = 1; dia <= totalDias; dia++) {
        const diaStr = dia.toString().padStart(2, '0');
        const mesStr = mes.toString().padStart(2, '0');
        const dataServico = `${ano}-${mesStr}-${diaStr}`;

        servicosGerados.push({
          data_servico: dataServico,
        });
      }
      
      createEscalaDto.servicos = servicosGerados;
    } else {
      const { mes, ano, servicos } = createEscalaDto;
      const totalDias = new Date(ano, mes, 0).getDate();
      const datasEsperadas = new Set(
        Array.from({ length: totalDias }, (_, indice) => {
          const dia = String(indice + 1).padStart(2, '0');
          return `${ano}-${String(mes).padStart(2, '0')}-${dia}`;
        }),
      );
      const datasRecebidas = new Set(servicos.map((servico) => servico.data_servico));
      const coresValidas = new Set(['PRETA', 'ROXA', 'VERMELHA']);

      const calendarioInvalido =
        datasRecebidas.size !== totalDias ||
        servicos.length !== totalDias ||
        servicos.some(
          (servico) =>
            !datasEsperadas.has(servico.data_servico) ||
            !coresValidas.has(servico.tipo_escala),
        );

      if (calendarioInvalido) {
        throw new BadRequestException(
          'O calendário deve conter cada dia do mês uma única vez, com uma cor válida.',
        );
      }
    }

    const novaEscala = escalaRepository.create({
      ...createEscalaDto,
      status: 'ABERTA',
    });
    return await escalaRepository.save(novaEscala);
  }

  async findAll(mes?: number, ano?: number, obm?: string, incluirArquivadas = false) {
    const filtros: any = {};
    if (mes) filtros.mes = mes;
    if (ano) filtros.ano = ano;
    if (obm) filtros.obm = obm;
    if (!incluirArquivadas) filtros.status = Not('ARQUIVADA');

    return await this.escalaRepository.find({
      where: filtros,
      relations: {
        servicos: {
          oficial_dia: true,
          oficial_sobreaviso: true,
        },
        fila_escolhas: {
          oficial: true,
        }
      },
    });
  }

  async findOne(id: number, obm?: string | null, incluirArquivada = false) {
    return await this.escalaRepository.findOne({
      where: {
        id,
        ...(obm ? { obm } : {}),
        ...(!incluirArquivada ? { status: Not('ARQUIVADA') } : {}),
      },
      relations: {
        servicos: {
          oficial_dia: true,
          oficial_sobreaviso: true,
        },
        // MUDANÇA AQUI TBM
        fila_escolhas: {
          oficial: true,
        }
      },
    });
  }

  async update(id: number, updateEscalaDto: UpdateEscalaDto, obm?: string | null) {
    const escala = await this.escalaRepository.findOne({
      where: { id, ...(obm ? { obm } : {}) },
    });
    if (!escala) {
      throw new NotFoundException('Escala não encontrada.');
    }
    if (escala.status === 'ARQUIVADA') {
      throw new BadRequestException('Uma escala arquivada não pode ser alterada.');
    }
    const result = await this.escalaRepository.update(
      { id, ...(obm ? { obm } : {}), status: Not('ARQUIVADA') },
      updateEscalaDto,
    );
    if (!result.affected) {
      throw new BadRequestException('A escala não pôde ser alterada porque foi arquivada.');
    }
    return await this.findOne(id, obm, true);
  }

  async remove(id: number, obm?: string | null) {
    const escala = await this.escalaRepository.findOne({
      where: { id, ...(obm ? { obm } : {}) },
    });
    if (!escala) {
      throw new NotFoundException('Escala não encontrada.');
    }
    if (escala.status === 'ARQUIVADA') {
      throw new BadRequestException('Uma escala arquivada não pode ser excluída.');
    }
    const result = await this.escalaRepository.delete({
      id,
      ...(obm ? { obm } : {}),
      status: Not('ARQUIVADA'),
    });
    if (!result.affected) {
      throw new BadRequestException('A escala não pôde ser excluída porque foi arquivada.');
    }
    return { mensagem: `Escala com ID ${id} removida com sucesso.` };
  }
}
