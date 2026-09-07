import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilaEscolha, StatusFila } from './entities/fila-escolha.entity';
import { Servico } from '../servico/entities/servico.entity';
import { Oficial } from '../oficial/entities/oficial.entity';

@Injectable()
export class FilaEscolhaService {
  constructor(
    @InjectRepository(FilaEscolha)
    private readonly filaRepository: Repository<FilaEscolha>,
    
    // Injetando o repositório do Serviço aqui
    @InjectRepository(Servico)
    private readonly servicoRepository: Repository<Servico>,
  ) {}

  // 1. Motor que recebe a ordem do Escalante e gera a fila
  async gerarFila(escalaId: number, oficiaisIdsOrdenados: number[]) {
    // Medida de segurança: Limpa a fila caso o escalante clique duas vezes sem querer
    await this.filaRepository.delete({ escala: { id: escalaId } });

    // Monta o array de inserção respeitando a ordem recebida (1º, 2º, 3º...)
    const filaRegistros = oficiaisIdsOrdenados.map((oficialId, index) => {
      return this.filaRepository.create({
        escala: { id: escalaId },
        oficial: { id: oficialId },
        posicao: index + 1,
        status: StatusFila.AGUARDANDO,
      });
    });

    // Persiste toda a tropa no banco de uma vez
    await this.filaRepository.save(filaRegistros);

    // Chama o método abaixo para acionar o cronômetro do oficial número 1
    return await this.iniciarTurno(escalaId, 1);
  }

  // 2. Aciona o cronômetro e muda o status de quem vai escolher
  async iniciarTurno(escalaId: number, posicao: number) {
    const turno = await this.filaRepository.findOne({
      where: { escala: { id: escalaId }, posicao: posicao },
      relations: {
        oficial: true,
      },
    });

    if (!turno) {
      throw new NotFoundException('Posição não encontrada na fila da escala.');
    }

    // O sistema define 24 horas cravadas para a escolha normal
    const dataInicio = new Date();
    const dataLimite = new Date();
    dataLimite.setHours(dataInicio.getHours() + 24);

    turno.status = StatusFila.ESCOLHENDO;
    turno.inicio_turno = dataInicio;
    turno.limite_turno = dataLimite;

    await this.filaRepository.save(turno);

    return { 
      mensagem: `Relógio acionado! Turno de escolha liberado para o oficial da posição ${posicao}.`, 
      limite_turno: turno.limite_turno 
    };
  }

  async obterFilaPorEscala(escalaId: number) {
    const fila = await this.filaRepository.find({
      where: { escala: { id: escalaId } },
      relations: { oficial: true },
      order: { posicao: 'ASC' },
    });

    if (!fila || fila.length === 0) {
      throw new NotFoundException('Nenhuma fila encontrada para esta escala.');
    }

    // Identifica quem está escolhendo no momento atual
    const atual = fila.find((f) => f.status === StatusFila.ESCOLHENDO);

    return {
      oficialAtual: atual ? `${atual.oficial.posto_graduacao} ${atual.oficial.nome}` : 'Nenhum turno ativo no momento',
      posicaoAtual: atual ? atual.posicao : null,
      limiteTurno: atual ? atual.limite_turno : null,
      progresso: fila,
    };
  }

  // Pula o oficial atual e ativa o próximo da fila
  async passarTurno(escalaId: number) {
    // 1. Encontra quem está com o turno ativo ('ESCOLHENDO')
    const turnoAtual = await this.filaRepository.findOne({
      where: { escala: { id: escalaId }, status: StatusFila.ESCOLHENDO },
    });

    if (!turnoAtual) {
      throw new NotFoundException('Não há nenhum oficial com o turno ativo no momento.');
    }

    // 2. Marca o atual como PULADO
    turnoAtual.status = StatusFila.PULADO;
    await this.filaRepository.save(turnoAtual);

    // 3. Busca o próximo na sequência matemática (posicao + 1)
    const proximaPosicao = turnoAtual.posicao + 1;
    const proximoTurno = await this.filaRepository.findOne({
      where: { escala: { id: escalaId }, posicao: proximaPosicao },
    });

    if (!proximoTurno) {
      return { mensagem: 'Fim da fila! Todos os oficiais já passaram pelo ciclo de escolha.' };
    }

    // 4. Inicia o turno do próximo
    return await this.iniciarTurno(escalaId, proximaPosicao);
  }

  // Finaliza o turno de escolha com sucesso e passa para o próximo
  async finalizarTurno(escalaId: number, oficialId: number) {
    // 1. Confere se é realmente o turno do oficial que está pedindo para finalizar
    const turnoAtual = await this.filaRepository.findOne({
      where: { 
        escala: { id: escalaId }, 
        oficial: { id: oficialId }, 
        status: StatusFila.ESCOLHENDO 
      },
    });

    if (!turnoAtual) {
      throw new BadRequestException('Acesso negado: Você não possui um turno ativo para finalizar.');
    }

    // 2. Validação de Cota: Conta quantas vagas ele pegou nessa escala (Dia ou Sobreaviso)
    const vagasEscolhidas = await this.servicoRepository.count({
      where: [
        { escala: { id: escalaId }, oficial_dia: { id: oficialId } },
        { escala: { id: escalaId }, oficial_sobreaviso: { id: oficialId } }
      ]
    });

    // Trava: O sistema não deixa o militar encerrar sem pegar nada (evita o "espertinho")
    if (vagasEscolhidas === 0) {
      throw new BadRequestException('Você precisa escolher pelo menos uma vaga (Titular ou Sobreaviso) antes de finalizar.');
    }

    // 3. Marca o turno do oficial atual como FINALIZADO (Missão Cumprida)
    turnoAtual.status = StatusFila.FINALIZADO;
    await this.filaRepository.save(turnoAtual);

    // 4. Descobre quem é o próximo da fila matematicamente
    const proximaPosicao = turnoAtual.posicao + 1;
    const proximoTurno = await this.filaRepository.findOne({
      where: { escala: { id: escalaId }, posicao: proximaPosicao },
    });

    // Se não tiver próximo, a escala de escolha inteira acabou!
    if (!proximoTurno) {
      return { 
        mensagem: 'Turno finalizado! Você era o último da fila. A escala está totalmente preenchida.',
        vagasEscolhidas 
      };
    }

    // 5. Inicia o relógio do próximo
    await this.iniciarTurno(escalaId, proximaPosicao);

    return { 
      mensagem: `Turno finalizado com sucesso! Você assumiu ${vagasEscolhidas} vaga(s). A vez passou para a posição ${proximaPosicao}.`,
      vagasEscolhidas
    };
  }
  

  async registrarEscolhaVaga(escalaId: number, oficialId: number, servicoId: number, tipoVaga: 'DIA' | 'SOBREAVISO') {
    // 1. Trava da Fila: Confere se realmente é a vez deste oficial
    const turnoAtivo = await this.filaRepository.findOne({
      where: { 
        escala: { id: escalaId }, 
        oficial: { id: oficialId }, 
        status: StatusFila.ESCOLHENDO 
      }
    });

    if (!turnoAtivo) {
      throw new BadRequestException('Acesso negado: Não é o seu turno de escolha no momento.');
    }

    // 2. Busca o serviço (dia) no banco, trazendo as relações para checar se já está ocupado
    const servico = await this.servicoRepository.findOne({ 
      where: { id: servicoId },
      relations: { oficial_dia: true, oficial_sobreaviso: true }
    });

    if (!servico) {
      throw new NotFoundException('Serviço não encontrado na escala.');
    }

    // 3. Trava de Ocupação: Checa se a cadeira solicitada está vazia
    if (tipoVaga === 'DIA') {
      if (servico.oficial_dia) {
        throw new BadRequestException('A vaga de Oficial de Dia para esta data já foi preenchida.');
      }
      // O TypeORM aceita injetar apenas o ID como objeto para criar a relação FK
      servico.oficial_dia = { id: oficialId } as Oficial; 
    } 
    else if (tipoVaga === 'SOBREAVISO') {
      if (servico.oficial_sobreaviso) {
        throw new BadRequestException('A vaga de Sobreaviso para esta data já foi preenchida.');
      }
      servico.oficial_sobreaviso = { id: oficialId } as Oficial;
    } 
    else {
      throw new BadRequestException('Tipo de vaga inválido. Use DIA ou SOBREAVISO.');
    }

    // 4. Salva o serviço com o oficial alocado
    await this.servicoRepository.save(servico);

    return { 
      mensagem: `Vaga de ${tipoVaga} garantida com sucesso!`, 
      servicoId: servico.id,
      tipoEscala: servico.tipo_escala
    };
  }
}