import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permuta, StatusPermuta } from './entities/permuta.entity';
import { Servico } from '../servico/entities/servico.entity';

@Injectable()
export class PermutaService {
  constructor(
    @InjectRepository(Permuta) private permutaRepository: Repository<Permuta>,
    @InjectRepository(Servico) private servicoRepository: Repository<Servico>,
  ) {}

  async solicitarPermuta(dto: any) {
    const permuta = this.permutaRepository.create({
      servico: { id: dto.servicoId },
      tipo_vaga: dto.tipoVaga,
      oficial_sainte: { id: dto.sainteId },
      oficial_entrante: { id: dto.entranteId },
      status: StatusPermuta.PENDENTE_ACORDO,
      criado_por: 'OFICIAL',
      justificativa: dto.justificativa
    });
    return await this.permutaRepository.save(permuta);
  }

  async trocaAdministrativa(dto: any) {
    const servico = await this.servicoRepository.findOne({ where: { id: dto.servicoId } });
    if (!servico) throw new BadRequestException('Serviço não encontrado.');

    // Registra o histórico de auditoria sempre que houver uma alteração
    if (dto.sainteId !== dto.entranteId) {
      // 1. Cria a base do registro sem as relações problemáticas
      const registroHistorico = this.permutaRepository.create({
        servico: { id: dto.servicoId },
        tipo_vaga: dto.tipoVaga,
        status: StatusPermuta.ADMINISTRATIVA,
        criado_por: 'ESCALANTE',
        justificativa: 'Alteração de ofício na grade.'
      });

      // 2. Injeta as relações "por fora" do create, onde o TypeScript aceita o null perfeitamente
      registroHistorico.oficial_sainte = dto.sainteId ? ({ id: dto.sainteId } as any) : null;
      registroHistorico.oficial_entrante = dto.entranteId ? ({ id: dto.entranteId } as any) : null;

      await this.permutaRepository.save(registroHistorico);
    }

    // 3. Atualiza o serviço principal
    if (dto.tipoVaga === 'DIA') {
      servico.oficial_dia = dto.entranteId ? ({ id: dto.entranteId } as any) : null;
    } else {
      servico.oficial_sobreaviso = dto.entranteId ? ({ id: dto.entranteId } as any) : null;
    }
    
    await this.servicoRepository.save(servico);
    
    return { mensagem: 'Grade atualizada com sucesso e registrada na auditoria.' };
  }

  async responderPermuta(id: number, acao: 'SIM' | 'NAO', respondidoPor: 'OFICIAL_ENVOLVIDO' | 'ESCALANTE', justificativa?: string) {
    const permuta = await this.permutaRepository.findOne({ 
      where: { id }, 
      relations: {
        servico: true,
        oficial_entrante: true
      } 
    });
    
    if (!permuta) throw new BadRequestException('Permuta não encontrada.');

    if (respondidoPor === 'OFICIAL_ENVOLVIDO') {
      permuta.status = acao === 'SIM' ? StatusPermuta.PENDENTE_APROVACAO : StatusPermuta.RECUSADA;
    } else if (respondidoPor === 'ESCALANTE') {
      permuta.status = acao === 'SIM' ? StatusPermuta.APROVADA : StatusPermuta.INDEFERIDA;
      
      if (acao === 'SIM') {
        const servico = await this.servicoRepository.findOne({ where: { id: permuta.servico.id } });
        
        if (!servico) {
            throw new BadRequestException('Serviço vinculado à permuta não foi encontrado no banco.');
        }

        if (permuta.tipo_vaga === 'DIA') {
          servico.oficial_dia = { id: permuta.oficial_entrante.id } as any;
        } else {
          servico.oficial_sobreaviso = { id: permuta.oficial_entrante.id } as any;
        }
        await this.servicoRepository.save(servico);
      }
    }

    if (justificativa) permuta.justificativa = justificativa;
    
    return await this.permutaRepository.save(permuta);
  }

  async findAll() {
    return await this.permutaRepository.find({
      relations: {
        servico: {
          escala: true, 
        },
        oficial_sainte: true,
        oficial_entrante: true,
      },
      order: {
        data_solicitacao: 'DESC', 
      },
    });
  }

  async publicarPermutas(ids: number[], boletim: string) {
    if (!ids || ids.length === 0) throw new BadRequestException('Nenhuma permuta selecionada.');
    
    await this.permutaRepository.update(ids, { boletim_interno: boletim });
    return { mensagem: 'Permutas publicadas com sucesso.' };
  }
}