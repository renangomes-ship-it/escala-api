import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CreateServicoDto } from './dto/create-servico.dto';
import { UpdateServicoDto } from './dto/update-servico.dto';
import { Servico } from './entities/servico.entity';
import { Escala } from '../escala/entities/escala.entity';
import { FilaEscolha } from '../fila-escolha/entities/fila-escolha.entity';

@Injectable()
export class ServicoService {
  constructor(
    @InjectRepository(Servico)
    private servicoRepository: Repository<Servico>,
    @InjectRepository(Escala)
    private escalaRepository: Repository<Escala>,
    @InjectRepository(FilaEscolha)
    private filaRepository: Repository<FilaEscolha>,
  ) {}

  private async validarAptidaoNaEscala(escalaId: number, oficialId?: number) {
    if (!oficialId) return;

    const registro = await this.filaRepository.findOne({
      where: { escala: { id: escalaId }, oficial: { id: oficialId } },
    });
    if (registro?.observacao === 'INAPTO') {
      throw new BadRequestException(
        'Este oficial foi declarado inapto para esta escala e não pode receber serviços.',
      );
    }
  }

  private async obterEscalaGravavel(id: number, obm?: string) {
    const escala = await this.escalaRepository.findOne({
      where: { id, ...(obm ? { obm } : {}) },
    });
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    if (escala.status === 'ARQUIVADA') {
      throw new BadRequestException(
        'Uma escala arquivada não pode ser alterada.',
      );
    }
    return escala;
  }

  private async obterServicoGravavel(id: number, obm?: string) {
    const servico = await this.servicoRepository.findOne({
      where: { id, ...(obm ? { escala: { obm } } : {}) },
      relations: { escala: true, oficial_dia: true, oficial_sobreaviso: true },
    });
    if (!servico) throw new NotFoundException('Serviço não encontrado.');
    if (servico.escala.status === 'ARQUIVADA') {
      throw new BadRequestException(
        'Uma escala arquivada não pode ser alterada.',
      );
    }
    return servico;
  }

  async create(createServicoDto: CreateServicoDto, obm?: string) {
    // TRAVA: Impede o mesmo oficial de acumular as duas funções no mesmo plantão
    if (
      createServicoDto.oficial_dia_id === createServicoDto.oficial_sobreaviso_id
    ) {
      throw new BadRequestException(
        'O mesmo oficial não pode ser escalado como Oficial de Dia e Sobreaviso no mesmo plantão.',
      );
    }
    const escala = await this.obterEscalaGravavel(
      createServicoDto.escala_id,
      obm,
    );
    await Promise.all([
      this.validarAptidaoNaEscala(escala.id, createServicoDto.oficial_dia_id),
      this.validarAptidaoNaEscala(
        escala.id,
        createServicoDto.oficial_sobreaviso_id,
      ),
    ]);

    const novoServico = this.servicoRepository.create({
      data_servico: createServicoDto.data_servico,
      escala,
      oficial_dia: { id: createServicoDto.oficial_dia_id },
      oficial_sobreaviso: { id: createServicoDto.oficial_sobreaviso_id },
    });

    return await this.servicoRepository.save(novoServico);
  }

  async findAll(obm?: string, incluirArquivados = false) {
    return await this.servicoRepository.find({
      where: {
        escala: {
          ...(obm ? { obm } : {}),
          ...(!incluirArquivados ? { status: Not('ARQUIVADA') } : {}),
        },
      },
      relations: { escala: true, oficial_dia: true, oficial_sobreaviso: true },
    });
  }

  async findOne(id: number, obm?: string, incluirArquivado = false) {
    const servico = await this.servicoRepository.findOne({
      where: {
        id,
        escala: {
          ...(obm ? { obm } : {}),
          ...(!incluirArquivado ? { status: Not('ARQUIVADA') } : {}),
        },
      },
      relations: { escala: true, oficial_dia: true, oficial_sobreaviso: true },
    });
    if (!servico) throw new NotFoundException('Serviço não encontrado.');
    return servico;
  }

  async update(id: number, updateServicoDto: UpdateServicoDto, obm?: string) {
    if (
      updateServicoDto.oficial_dia_id !== undefined ||
      updateServicoDto.oficial_sobreaviso_id !== undefined
    ) {
      throw new BadRequestException(
        'Alterações de oficiais devem usar o fluxo administrativo da grade.',
      );
    }

    const servico = await this.obterServicoGravavel(id, obm);
    if (
      updateServicoDto.escala_id &&
      updateServicoDto.escala_id !== servico.escala.id
    ) {
      servico.escala = await this.obterEscalaGravavel(
        updateServicoDto.escala_id,
        obm,
      );
    }
    const alterandoCor =
      updateServicoDto.tipo_escala !== undefined &&
      updateServicoDto.tipo_escala !== servico.tipo_escala;
    const escolhaFinalizada = ['FECHADA', 'PUBLICADA'].includes(
      servico.escala.status,
    );
    if (alterandoCor && !escolhaFinalizada) {
      throw new BadRequestException(
        'A cor dos dias só pode ser alterada depois que a escolha for encerrada.',
      );
    }
    if (updateServicoDto.data_servico !== undefined) {
      servico.data_servico = updateServicoDto.data_servico;
    }
    if (updateServicoDto.tipo_escala !== undefined) {
      servico.tipo_escala = updateServicoDto.tipo_escala;
    }
    const oficialDiaId = servico.oficial_dia?.id;
    const oficialSobreavisoId = servico.oficial_sobreaviso?.id;
    if (
      oficialDiaId !== undefined &&
      oficialSobreavisoId !== undefined &&
      oficialDiaId === oficialSobreavisoId
    ) {
      throw new BadRequestException(
        'O mesmo oficial não pode ocupar as duas funções no mesmo plantão.',
      );
    }
    return await this.servicoRepository.save(servico);
  }

  async remove(id: number, obm?: string) {
    const servico = await this.obterServicoGravavel(id, obm);
    await this.servicoRepository.delete(servico.id);
    return { mensagem: `Serviço com ID ${id} removido com sucesso.` };
  }
}
