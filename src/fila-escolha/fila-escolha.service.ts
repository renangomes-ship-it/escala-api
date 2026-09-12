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
    
    @InjectRepository(Servico)
    private readonly servicoRepository: Repository<Servico>,
  ) {}

  // 1. GERAR A FILA COM AS COTAS
  async gerarFila(escalaId: number, dadosFila: any[]) {
    // Medida de segurança: Limpa a fila caso o escalante clique duas vezes sem querer
    await this.filaRepository.delete({ escala: { id: escalaId } });

    const filaRegistros = dadosFila.map((dado, index) => {
      return this.filaRepository.create({
        escala: { id: escalaId },
        oficial: { id: dado.oficialId },
        posicao: index + 1,
        // Se for Inapto, já nasce finalizado para não trancar a fila
        status: dado.apto ? StatusFila.AGUARDANDO : StatusFila.FINALIZADO,
        cota_preta: dado.cotas.pretas,
        cota_roxa: dado.cotas.roxas,
        cota_vermelha: dado.cotas.vermelhas,
        observacao: dado.apto ? '' : 'INAPTO',
      });
    });

    await this.filaRepository.save(filaRegistros);
    await this.avancarFila(escalaId); // Inicia o primeiro
    return { mensagem: 'Fila gerada e iniciada com sucesso!' };
  }

  // Lógica interna para achar o próximo válido
  private async avancarFila(escalaId: number) {
    const proximo = await this.filaRepository.findOne({
      where: { escala: { id: escalaId }, status: StatusFila.AGUARDANDO },
      order: { posicao: 'ASC' }
    });

    if (proximo) {
      const limite = new Date();
      limite.setHours(limite.getHours() + 24); // 24h Padrão
      
      proximo.status = StatusFila.ESCOLHENDO;
      proximo.inicio_turno = new Date();
      proximo.limite_turno = limite;
      
      await this.filaRepository.save(proximo);
      return { mensagem: `Turno passado para a posição ${proximo.posicao}` };
    }
    
    return { mensagem: 'A fila acabou! A escala está preenchida.' };
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

    const atual = fila.find((f) => f.status === StatusFila.ESCOLHENDO);

    return {
      oficialAtual: atual ? `${atual.oficial.posto_graduacao} ${atual.oficial.nome}` : 'Nenhum turno ativo no momento',
      posicaoAtual: atual ? atual.posicao : null,
      limiteTurno: atual ? atual.limite_turno : null,
      progresso: fila,
    };
  }

  // 2. PULAR OFICIAL
  async passarTurno(escalaId: number) {
    const turnoAtual = await this.filaRepository.findOne({
      where: { escala: { id: escalaId }, status: StatusFila.ESCOLHENDO },
    });

    if (!turnoAtual) {
      throw new NotFoundException('Não há nenhum oficial com o turno ativo no momento.');
    }

    turnoAtual.status = StatusFila.PULADO;
    await this.filaRepository.save(turnoAtual);

    return await this.avancarFila(escalaId);
  }

  // 3. REIVINDICAR VEZ (Roubo)
  async reivindicarVez(escalaId: number, oficialId: number) {
    const meuTurno = await this.filaRepository.findOne({ 
      where: { escala: { id: escalaId }, oficial: { id: oficialId } } 
    });

    if (!meuTurno || meuTurno.status !== StatusFila.PULADO) {
      throw new BadRequestException('Você só pode reivindicar se tiver sido pulado.');
    }

    const turnoAtual = await this.filaRepository.findOne({ 
      where: { escala: { id: escalaId }, status: StatusFila.ESCOLHENDO } 
    });

    if (!turnoAtual) {
      throw new BadRequestException('Ninguém está escolhendo no momento.');
    }

    if (turnoAtual.posicao <= meuTurno.posicao) {
      throw new BadRequestException('Você não pode reivindicar a vez de um oficial mais antigo que você.');
    }

    // Interrompe o atual
    turnoAtual.status = StatusFila.INTERROMPIDO;
    await this.filaRepository.save(turnoAtual);

    // Ativa o reivindicante com punição (Apenas 1 hora)
    const limite = new Date();
    limite.setHours(limite.getHours() + 1);
    
    meuTurno.status = StatusFila.ESCOLHENDO;
    meuTurno.inicio_turno = new Date();
    meuTurno.limite_turno = limite;
    await this.filaRepository.save(meuTurno);

    return { mensagem: 'Vez reivindicada com sucesso. Você tem 1 hora.' };
  }

  // 4. FINALIZAR ESCOLHA
  async finalizarTurno(escalaId: number, oficialId: number) {
    const meuTurno = await this.filaRepository.findOne({ 
      where: { escala: { id: escalaId }, oficial: { id: oficialId }, status: StatusFila.ESCOLHENDO } 
    });

    if (!meuTurno) {
      throw new BadRequestException('Acesso negado: Você não possui um turno ativo para finalizar.');
    }

    // Validação de Cota: Conta quantas vagas ele pegou nessa escala (Dia ou Sobreaviso)
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

    meuTurno.status = StatusFila.FINALIZADO;
    await this.filaRepository.save(meuTurno);

    // Vê se alguém foi interrompido (devolve a vez pra ele)
    const turnoInterrompido = await this.filaRepository.findOne({ 
      where: { escala: { id: escalaId }, status: StatusFila.INTERROMPIDO } 
    });
    
    if (turnoInterrompido) {
      const limite = new Date();
      limite.setHours(limite.getHours() + 24); // Devolve as 24h inteiras pra ele
      
      turnoInterrompido.status = StatusFila.ESCOLHENDO;
      turnoInterrompido.limite_turno = limite;
      await this.filaRepository.save(turnoInterrompido);
      
      return { 
        mensagem: `Turno finalizado! Você assumiu ${vagasEscolhidas} vaga(s). O oficial interrompido retornou.`,
        vagasEscolhidas
      };
    }

    // Se ninguém foi interrompido, fila anda normal
    const proximoPasso = await this.avancarFila(escalaId);
    return {
      mensagem: `Turno finalizado com sucesso! Você assumiu ${vagasEscolhidas} vaga(s). ${proximoPasso.mensagem}`,
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

  // 5. DESFAZER ESCOLHA DE VAGA
  async removerEscolhaVaga(escalaId: number, oficialId: number, servicoId: number, tipoVaga: 'DIA' | 'SOBREAVISO') {
    const turnoAtivo = await this.filaRepository.findOne({ where: { escala: { id: escalaId }, oficial: { id: oficialId }, status: StatusFila.ESCOLHENDO } });
    if (!turnoAtivo) throw new BadRequestException('Acesso negado: Não é o seu turno.');

    const servico = await this.servicoRepository.findOne({ where: { id: servicoId }, relations: { oficial_dia: true, oficial_sobreaviso: true } });
    if (!servico) throw new NotFoundException('Serviço não encontrado.');

    if (tipoVaga === 'DIA') {
      if (servico.oficial_dia?.id !== oficialId) throw new BadRequestException('Você só pode remover a sua própria escolha.');
      
      // O 'as any' acalma o TypeScript e permite que o TypeORM limpe a vaga no banco
      servico.oficial_dia = null as any; 
      
    } else {
      if (servico.oficial_sobreaviso?.id !== oficialId) throw new BadRequestException('Você só pode remover a sua própria escolha.');
      
      // O 'as any' acalma o TypeScript e permite que o TypeORM limpe a vaga no banco
      servico.oficial_sobreaviso = null as any;
    }

    await this.servicoRepository.save(servico);
    return { mensagem: 'Escolha removida com sucesso.' };
  }
}