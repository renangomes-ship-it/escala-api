import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import { FilaEscolha, StatusFila } from './entities/fila-escolha.entity';
import { Servico } from '../servico/entities/servico.entity';
import { Oficial } from '../oficial/entities/oficial.entity';
import { Escala } from '../escala/entities/escala.entity';
import { ItemFilaDto } from './dto/gerar-fila.dto';

@Injectable()
export class FilaEscolhaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FilaEscolhaService.name);
  private intervaloVencimentos?: NodeJS.Timeout;
  private processandoVencimentos = false;

  constructor(
    @InjectRepository(FilaEscolha)
    private readonly filaRepository: Repository<FilaEscolha>,
    
    @InjectRepository(Servico)
    private readonly servicoRepository: Repository<Servico>,
    @InjectRepository(Escala)
    private readonly escalaRepository: Repository<Escala>,
  ) {}

  onModuleInit() {
    this.intervaloVencimentos = setInterval(() => {
      void this.processarTurnosVencidos().catch((erro) => {
        this.logger.error('Não foi possível processar os turnos vencidos.', erro);
      });
    }, 15_000);
    this.intervaloVencimentos.unref();
  }

  onModuleDestroy() {
    if (this.intervaloVencimentos) clearInterval(this.intervaloVencimentos);
  }

  private repositorios(manager?: EntityManager) {
    return {
      filaRepository: manager?.getRepository(FilaEscolha) ?? this.filaRepository,
      servicoRepository: manager?.getRepository(Servico) ?? this.servicoRepository,
      escalaRepository: manager?.getRepository(Escala) ?? this.escalaRepository,
    };
  }

  async processarTurnosVencidos() {
    if (this.processandoVencimentos) return;
    this.processandoVencimentos = true;
    try {
      const vencidos = await this.filaRepository.find({
        where: {
          status: StatusFila.ESCOLHENDO,
          limite_turno: LessThanOrEqual(new Date()),
        },
        relations: { escala: true },
      });

      for (const turno of vencidos) {
        if (turno.escala.status === 'ARQUIVADA') continue;
        if (turno.observacao === 'RETORNO_FIM_FILA') continue;
        await this.passarTurno(turno.escala.id, turno.escala.obm);
      }
    } finally {
      this.processandoVencimentos = false;
    }
  }

  private async validarAcessoEscala(
    escalaId: number,
    obm?: string | null,
    permitirArquivada = false,
    manager?: EntityManager,
  ) {
    const { escalaRepository } = this.repositorios(manager);
    const escala = await escalaRepository.findOne({
      where: { id: escalaId, ...(obm ? { obm } : {}) },
    });
    if (!escala) {
      throw new NotFoundException('Escala não encontrada.');
    }
    if (escala.status === 'ARQUIVADA' && !permitirArquivada) {
      if (obm) throw new NotFoundException('Escala não encontrada.');
      throw new BadRequestException('Uma escala arquivada não pode ser alterada.');
    }
    return escala;
  }

  private async obterCotasEscolhidas(escalaId: number, oficialId: number) {
    const cores = ['PRETA', 'ROXA', 'VERMELHA'] as const;
    const contagens = await Promise.all(
      cores.flatMap((tipo_escala) => [
        this.servicoRepository.count({
          where: { escala: { id: escalaId }, tipo_escala, oficial_dia: { id: oficialId } },
        }),
        this.servicoRepository.count({
          where: { escala: { id: escalaId }, tipo_escala, oficial_sobreaviso: { id: oficialId } },
        }),
      ]),
    );

    return {
      dia: { preta: contagens[0], roxa: contagens[2], vermelha: contagens[4] },
      sobreaviso: { preta: contagens[1], roxa: contagens[3], vermelha: contagens[5] },
    };
  }

  private prazoVencido(turno: FilaEscolha): boolean {
    return !turno.limite_turno || new Date(turno.limite_turno).getTime() <= Date.now();
  }

  private ehTurnoDeReivindicacao(turno: FilaEscolha): boolean {
    return turno.observacao === 'REIVINDICACAO';
  }

  private async retomarTurnoInterrompido(escalaId: number, inicioReivindicacao: Date) {
    const turnoInterrompido = await this.filaRepository.findOne({
      where: { escala: { id: escalaId }, status: StatusFila.INTERROMPIDO },
    });
    if (!turnoInterrompido || !turnoInterrompido.limite_turno) {
      return null;
    }

    const duracaoDaInterrupcao = Math.max(
      0,
      Date.now() - new Date(inicioReivindicacao).getTime(),
    );
    turnoInterrompido.status = StatusFila.ESCOLHENDO;
    turnoInterrompido.inicio_turno = new Date();
    turnoInterrompido.limite_turno = new Date(
      new Date(turnoInterrompido.limite_turno).getTime() + duracaoDaInterrupcao,
    );
    await this.filaRepository.save(turnoInterrompido);
    return turnoInterrompido;
  }

  private async atribuirUltimoOficial(
    escalaId: number,
    manager?: EntityManager,
  ) {
    const { filaRepository, servicoRepository, escalaRepository } =
      this.repositorios(manager);
    const fila = await filaRepository.find({
      where: { escala: { id: escalaId } },
      relations: { oficial: true },
    });
    const pendentes = fila.filter((registro) => registro.status !== StatusFila.FINALIZADO);
    if (pendentes.length !== 1) {
      return null;
    }

    const ultimo = pendentes[0];
    const oficialId = ultimo.oficial?.id;
    if (!oficialId) {
      throw new BadRequestException('O último registro da fila não possui oficial vinculado.');
    }

    const servicos = await servicoRepository.find({
      where: { escala: { id: escalaId } },
      relations: { oficial_dia: true, oficial_sobreaviso: true },
    });
    const cores = ['PRETA', 'ROXA', 'VERMELHA'] as const;
    const cotas = {
      PRETA: ultimo.cota_preta,
      ROXA: ultimo.cota_roxa,
      VERMELHA: ultimo.cota_vermelha,
    };
    const ocupadas = {
      DIA: { PRETA: 0, ROXA: 0, VERMELHA: 0 },
      SOBREAVISO: { PRETA: 0, ROXA: 0, VERMELHA: 0 },
    };
    const vagas = {
      DIA: { PRETA: 0, ROXA: 0, VERMELHA: 0 },
      SOBREAVISO: { PRETA: 0, ROXA: 0, VERMELHA: 0 },
    };

    for (const servico of servicos) {
      if (!cores.includes(servico.tipo_escala as (typeof cores)[number])) {
        await escalaRepository.update(escalaId, { status: 'PENDENTE_AJUSTE_MANUAL' });
        return { bloqueada: true };
      }
      const cor = servico.tipo_escala as (typeof cores)[number];
      if (servico.oficial_dia?.id === oficialId) ocupadas.DIA[cor] += 1;
      if (servico.oficial_sobreaviso?.id === oficialId) ocupadas.SOBREAVISO[cor] += 1;
      if (!servico.oficial_dia) vagas.DIA[cor] += 1;
      if (!servico.oficial_sobreaviso) vagas.SOBREAVISO[cor] += 1;
    }

    const faltam = {
      DIA: { PRETA: 0, ROXA: 0, VERMELHA: 0 },
      SOBREAVISO: { PRETA: 0, ROXA: 0, VERMELHA: 0 },
    };
    let compativel = true;
    for (const cor of cores) {
      faltam.DIA[cor] = cotas[cor] - ocupadas.DIA[cor];
      faltam.SOBREAVISO[cor] = cotas[cor] - ocupadas.SOBREAVISO[cor];
      if (
        faltam.DIA[cor] < 0 ||
        faltam.SOBREAVISO[cor] < 0 ||
        faltam.DIA[cor] !== vagas.DIA[cor] ||
        faltam.SOBREAVISO[cor] !== vagas.SOBREAVISO[cor]
      ) {
        compativel = false;
      }
    }

    for (const servico of servicos) {
      const cor = servico.tipo_escala as (typeof cores)[number];
      if (!cores.includes(cor)) continue;
      const precisaDia = !servico.oficial_dia && faltam.DIA[cor] > 0;
      const precisaSobreaviso = !servico.oficial_sobreaviso && faltam.SOBREAVISO[cor] > 0;
      if (precisaDia && precisaSobreaviso) {
        compativel = false;
      }
    }

    if (!compativel) {
      await escalaRepository.update(escalaId, { status: 'PENDENTE_AJUSTE_MANUAL' });
      return { bloqueada: true };
    }

    for (const servico of servicos) {
      const cor = servico.tipo_escala as (typeof cores)[number];
      if (!servico.oficial_dia && faltam.DIA[cor] > 0) {
        servico.oficial_dia = { id: oficialId } as Oficial;
        faltam.DIA[cor] -= 1;
      }
      if (!servico.oficial_sobreaviso && faltam.SOBREAVISO[cor] > 0) {
        servico.oficial_sobreaviso = { id: oficialId } as Oficial;
        faltam.SOBREAVISO[cor] -= 1;
      }
    }

    await servicoRepository.save(servicos);
    ultimo.status = StatusFila.FINALIZADO;
    await filaRepository.save(ultimo);
    return { bloqueada: false, oficial: ultimo.oficial };
  }

  // 1. GERAR A FILA COM AS COTAS
  async gerarFila(
    escalaId: number,
    dadosFila: ItemFilaDto[],
    obm?: string | null,
    manager?: EntityManager,
  ) {
    const { filaRepository, servicoRepository } = this.repositorios(manager);
    await this.validarAcessoEscala(escalaId, obm, false, manager);
    if (!Array.isArray(dadosFila) || dadosFila.length === 0) {
      throw new BadRequestException('Informe pelo menos um oficial para gerar a fila.');
    }

    const oficiaisInformados = new Set<number>();
    const totaisCotas = { pretas: 0, roxas: 0, vermelhas: 0 };

    for (const dado of dadosFila) {
      const cotas = dado?.cotas;
      const cotasValidas =
        cotas &&
        ['pretas', 'roxas', 'vermelhas'].every(
          (cor) => Number.isInteger(cotas[cor]) && cotas[cor] >= 0,
        );

      if (!Number.isInteger(dado?.oficialId) || oficiaisInformados.has(dado.oficialId) || !cotasValidas) {
        throw new BadRequestException('A fila contém oficial ou cotas inválidas.');
      }
      oficiaisInformados.add(dado.oficialId);

      const totalIndividual = cotas.pretas + cotas.roxas + cotas.vermelhas;
      if (dado.apto && totalIndividual === 0) {
        throw new BadRequestException('Todo oficial apto deve receber ao menos uma cota.');
      }
      if (!dado.apto && totalIndividual !== 0) {
        throw new BadRequestException('Oficial inapto não pode receber cotas.');
      }
      const justificativaInaptidao = dado.justificativaInaptidao?.trim();
      if (!dado.apto && !justificativaInaptidao) {
        throw new BadRequestException(
          'Informe a justificativa de inaptidão de cada oficial inapto.',
        );
      }

      totaisCotas.pretas += cotas.pretas;
      totaisCotas.roxas += cotas.roxas;
      totaisCotas.vermelhas += cotas.vermelhas;
    }

    const servicos = await servicoRepository.find({
      where: { escala: { id: escalaId } },
    });
    const totaisCalendario = {
      pretas: servicos.filter((servico) => servico.tipo_escala === 'PRETA').length,
      roxas: servicos.filter((servico) => servico.tipo_escala === 'ROXA').length,
      vermelhas: servicos.filter((servico) => servico.tipo_escala === 'VERMELHA').length,
    };
    if (
      totaisCotas.pretas !== totaisCalendario.pretas ||
      totaisCotas.roxas !== totaisCalendario.roxas ||
      totaisCotas.vermelhas !== totaisCalendario.vermelhas
    ) {
      throw new BadRequestException('As cotas por cor devem corresponder ao calendário da escala.');
    }

    // Medida de segurança: Limpa a fila caso o escalante clique duas vezes sem querer
    await filaRepository.delete({ escala: { id: escalaId } });

    const filaRegistros = dadosFila.map((dado, index) => {
      return filaRepository.create({
        escala: { id: escalaId },
        oficial: { id: dado.oficialId },
        posicao: index + 1,
        // Se for Inapto, já nasce finalizado para não trancar a fila
        status: dado.apto ? StatusFila.AGUARDANDO : StatusFila.FINALIZADO,
        cota_preta: dado.cotas.pretas,
        cota_roxa: dado.cotas.roxas,
        cota_vermelha: dado.cotas.vermelhas,
        observacao: dado.apto ? '' : 'INAPTO',
        justificativa_inaptidao: dado.apto
          ? null
          : dado.justificativaInaptidao!.trim(),
      });
    });

    await filaRepository.save(filaRegistros);
    await this.avancarFila(escalaId, manager); // Inicia o primeiro
    return { mensagem: 'Fila gerada e iniciada com sucesso!' };
  }

  // Lógica interna para achar o próximo válido
  private async avancarFila(escalaId: number, manager?: EntityManager) {
    const { filaRepository } = this.repositorios(manager);
    const resultadoAutomatico = await this.atribuirUltimoOficial(escalaId, manager);
    if (resultadoAutomatico?.bloqueada) {
      return { mensagem: 'As vagas restantes exigem ajuste manual do escalante.' };
    }
    if (resultadoAutomatico?.oficial) {
      return { mensagem: `As vagas restantes foram atribuídas automaticamente a ${resultadoAutomatico.oficial.nome}.` };
    }

    const proximo = await filaRepository.findOne({
      where: { escala: { id: escalaId }, status: StatusFila.AGUARDANDO },
      order: { posicao: 'ASC' }
    });

    if (proximo) {
      const limite = new Date();
      limite.setHours(limite.getHours() + 24); // 24h Padrão
      
      proximo.status = StatusFila.ESCOLHENDO;
      proximo.inicio_turno = new Date();
      proximo.limite_turno = limite;
      
      await filaRepository.save(proximo);
      return { mensagem: `Turno passado para a posição ${proximo.posicao}` };
    }

    const pulado = await filaRepository.findOne({
      where: { escala: { id: escalaId }, status: StatusFila.PULADO },
      order: { posicao: 'ASC' },
    });
    if (pulado) {
      pulado.status = StatusFila.AGUARDANDO;
      pulado.observacao = 'RETORNO_FIM_FILA';
      await filaRepository.save(pulado);
      return this.avancarFila(escalaId, manager);
    }
    
    return { mensagem: 'A fila acabou! A escala está preenchida.' };
  }

  async obterFilaPorEscala(escalaId: number, obm?: string | null) {
    await this.validarAcessoEscala(escalaId, obm, !obm);
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
      turnoVencido: atual ? this.prazoVencido(atual) : false,
      progresso: fila,
    };
  }

  // 2. PULAR OFICIAL
  async passarTurno(escalaId: number, obm?: string | null) {
    await this.validarAcessoEscala(escalaId, obm);
    const turnoAtual = await this.filaRepository.findOne({
      where: { escala: { id: escalaId }, status: StatusFila.ESCOLHENDO },
    });

    if (!turnoAtual) {
      throw new NotFoundException('Não há nenhum oficial com o turno ativo no momento.');
    }

    const eraReivindicacao = this.ehTurnoDeReivindicacao(turnoAtual);
    const venceu = this.prazoVencido(turnoAtual);
    const inicioReivindicacao = turnoAtual.inicio_turno;
    turnoAtual.status = StatusFila.PULADO;

    if (eraReivindicacao && venceu) {
      const ultimoDaFila = await this.filaRepository.findOne({
        where: { escala: { id: escalaId } },
        order: { posicao: 'DESC' },
      });
      turnoAtual.status = StatusFila.AGUARDANDO;
      turnoAtual.posicao = (ultimoDaFila?.posicao || turnoAtual.posicao) + 1;
      turnoAtual.inicio_turno = null as any;
      turnoAtual.limite_turno = null as any;
      turnoAtual.observacao = 'RETORNO_FIM_FILA';
    }
    await this.filaRepository.save(turnoAtual);

    if (eraReivindicacao && inicioReivindicacao) {
      const interrompido = await this.retomarTurnoInterrompido(
        escalaId,
        inicioReivindicacao,
      );
      if (interrompido) {
        return {
          mensagem: venceu
            ? 'A reivindicação venceu e o oficial voltou ao fim da fila. O turno interrompido foi retomado.'
            : 'O turno interrompido foi retomado.',
        };
      }
    }

    return await this.avancarFila(escalaId);
  }

  // 3. REIVINDICAR VEZ (Roubo)
  async reivindicarVez(escalaId: number, oficialId: number, obm?: string | null) {
    await this.validarAcessoEscala(escalaId, obm);
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
    if (this.prazoVencido(turnoAtual)) {
      throw new BadRequestException('O turno atual venceu e precisa de decisão manual do escalante.');
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
    meuTurno.observacao = 'REIVINDICACAO';
    meuTurno.inicio_turno = new Date();
    meuTurno.limite_turno = limite;
    await this.filaRepository.save(meuTurno);

    return { mensagem: 'Vez reivindicada com sucesso. Você tem 1 hora.' };
  }

  // 4. FINALIZAR ESCOLHA
  async finalizarTurno(escalaId: number, oficialId: number, obm?: string | null) {
    await this.validarAcessoEscala(escalaId, obm);
    const meuTurno = await this.filaRepository.findOne({ 
      where: { escala: { id: escalaId }, oficial: { id: oficialId }, status: StatusFila.ESCOLHENDO } 
    });

    if (!meuTurno) {
      throw new BadRequestException('Acesso negado: Você não possui um turno ativo para finalizar.');
    }
    if (this.prazoVencido(meuTurno)) {
      throw new BadRequestException('Seu prazo de escolha venceu. Aguarde a decisão do escalante.');
    }

    const cotasEscolhidas = await this.obterCotasEscolhidas(escalaId, oficialId);
    const cotasDefinidas = {
      preta: meuTurno.cota_preta,
      roxa: meuTurno.cota_roxa,
      vermelha: meuTurno.cota_vermelha,
    };
    const cotasCompletas = (['preta', 'roxa', 'vermelha'] as const).every(
      (cor) =>
        cotasEscolhidas.dia[cor] === cotasDefinidas[cor] &&
        cotasEscolhidas.sobreaviso[cor] === cotasDefinidas[cor],
    );
    if (!cotasCompletas) {
      throw new BadRequestException(
        'As cotas de titular e sobreaviso por cor precisam estar completas antes de finalizar.',
      );
    }

    const vagasEscolhidas =
      cotasEscolhidas.dia.preta +
      cotasEscolhidas.dia.roxa +
      cotasEscolhidas.dia.vermelha +
      cotasEscolhidas.sobreaviso.preta +
      cotasEscolhidas.sobreaviso.roxa +
      cotasEscolhidas.sobreaviso.vermelha;

    meuTurno.status = StatusFila.FINALIZADO;
    if (meuTurno.observacao === 'REIVINDICACAO') meuTurno.observacao = '';
    await this.filaRepository.save(meuTurno);

    const resultadoAutomatico = await this.atribuirUltimoOficial(escalaId);
    if (resultadoAutomatico?.bloqueada) {
      return {
        mensagem: 'Sua escolha foi finalizada. As vagas restantes exigem ajuste manual do escalante.',
        vagasEscolhidas,
      };
    }
    if (resultadoAutomatico?.oficial) {
      return {
        mensagem: `Sua escolha foi finalizada. As vagas restantes foram atribuídas automaticamente a ${resultadoAutomatico.oficial.nome}.`,
        vagasEscolhidas,
      };
    }

    // Vê se alguém foi interrompido (devolve a vez pra ele)
    const turnoInterrompido = await this.retomarTurnoInterrompido(
      escalaId,
      meuTurno.inicio_turno,
    );

    if (turnoInterrompido) {
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

  async finalizarEscolhaManual(
    escalaId: number,
    oficialId: number,
    obm?: string | null,
  ) {
    const escala = await this.validarAcessoEscala(escalaId, obm);
    const fila = await this.filaRepository.find({
      where: { escala: { id: escalaId } },
      relations: { oficial: true },
    });
    const registro = fila.find((item) => item.oficial?.id === oficialId);
    if (!registro || registro.status === StatusFila.FINALIZADO) {
      throw new BadRequestException('Este oficial não possui uma escolha pendente nesta escala.');
    }

    const pendentes = fila.filter((item) => item.status !== StatusFila.FINALIZADO);
    const segundoPrazoVencido =
      registro.status === StatusFila.ESCOLHENDO &&
      registro.observacao === 'RETORNO_FIM_FILA' &&
      this.prazoVencido(registro);
    const ultimoComAjustePendente =
      escala.status === 'PENDENTE_AJUSTE_MANUAL' &&
      pendentes.length === 1 &&
      pendentes[0].id === registro.id;

    if (!segundoPrazoVencido && !ultimoComAjustePendente) {
      throw new BadRequestException(
        'A escolha manual só está disponível no segundo prazo vencido ou no ajuste do último oficial.',
      );
    }

    const cotasEscolhidas = await this.obterCotasEscolhidas(escalaId, oficialId);
    const cotasDefinidas = {
      preta: registro.cota_preta,
      roxa: registro.cota_roxa,
      vermelha: registro.cota_vermelha,
    };
    const cotasCompletas = (['preta', 'roxa', 'vermelha'] as const).every(
      (cor) =>
        cotasEscolhidas.dia[cor] === cotasDefinidas[cor] &&
        cotasEscolhidas.sobreaviso[cor] === cotasDefinidas[cor],
    );
    if (!cotasCompletas) {
      throw new BadRequestException(
        'Ajuste incompleto: as cotas de titular e sobreaviso por cor ainda não foram cumpridas.',
      );
    }

    const servicos = await this.servicoRepository.find({
      where: { escala: { id: escalaId } },
      relations: { oficial_dia: true, oficial_sobreaviso: true },
    });
    const duplaFuncao = servicos.some(
      (servico) =>
        servico.oficial_dia?.id === oficialId &&
        servico.oficial_sobreaviso?.id === oficialId,
    );
    if (duplaFuncao) {
      throw new BadRequestException(
        'O oficial não pode ocupar titular e sobreaviso no mesmo dia.',
      );
    }

    registro.status = StatusFila.FINALIZADO;
    registro.observacao = 'CONCLUIDO_MANUALMENTE';
    await this.filaRepository.save(registro);
    if (escala.status === 'PENDENTE_AJUSTE_MANUAL') {
      await this.escalaRepository.update(escalaId, { status: 'ABERTA' });
    }

    const proximoPasso = await this.avancarFila(escalaId);
    return {
      mensagem: `Escolha manual concluída com sucesso. ${proximoPasso.mensagem}`,
      cotasEscolhidas,
    };
  }

  async registrarEscolhaVaga(
    escalaId: number,
    oficialId: number,
    servicoId: number,
    tipoVaga: 'DIA' | 'SOBREAVISO',
    obm?: string | null,
  ) {
    await this.validarAcessoEscala(escalaId, obm);
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
    if (this.prazoVencido(turnoAtivo)) {
      throw new BadRequestException('Seu prazo de escolha venceu. Aguarde a decisão do escalante.');
    }

    // 2. Busca o serviço (dia) no banco, trazendo as relações para checar se já está ocupado
    const servico = await this.servicoRepository.findOne({ 
      where: { id: servicoId, escala: { id: escalaId } },
      relations: { oficial_dia: true, oficial_sobreaviso: true }
    });

    if (!servico) {
      throw new NotFoundException('Serviço não encontrado na escala.');
    }

    const cor = servico.tipo_escala?.toLowerCase();
    if (cor !== 'preta' && cor !== 'roxa' && cor !== 'vermelha') {
      throw new BadRequestException('O serviço possui uma cor inválida.');
    }

    const cotaMaxima = turnoAtivo[`cota_${cor}`];
    const campoOficial = tipoVaga === 'DIA' ? 'oficial_dia' : 'oficial_sobreaviso';
    const escolhasNaCor = await this.servicoRepository.count({
      where: {
        escala: { id: escalaId },
        tipo_escala: servico.tipo_escala,
        [campoOficial]: { id: oficialId },
      },
    });
    if (escolhasNaCor >= cotaMaxima) {
      throw new BadRequestException('Sua cota para esta cor e função já foi preenchida.');
    }

    // 3. Trava de ocupação e de dupla função no mesmo dia
    if (tipoVaga === 'DIA') {
      if (servico.oficial_dia) {
        throw new BadRequestException('A vaga de Oficial de Dia para esta data já foi preenchida.');
      }
      if (servico.oficial_sobreaviso?.id === oficialId) {
        throw new BadRequestException('O mesmo oficial não pode ocupar as duas funções no mesmo dia.');
      }
      // O TypeORM aceita injetar apenas o ID como objeto para criar a relação FK
      servico.oficial_dia = { id: oficialId } as Oficial; 
    } 
    else if (tipoVaga === 'SOBREAVISO') {
      if (servico.oficial_sobreaviso) {
        throw new BadRequestException('A vaga de Sobreaviso para esta data já foi preenchida.');
      }
      if (servico.oficial_dia?.id === oficialId) {
        throw new BadRequestException('O mesmo oficial não pode ocupar as duas funções no mesmo dia.');
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
  async removerEscolhaVaga(
    escalaId: number,
    oficialId: number,
    servicoId: number,
    tipoVaga: 'DIA' | 'SOBREAVISO',
    obm?: string | null,
  ) {
    await this.validarAcessoEscala(escalaId, obm);
    const turnoAtivo = await this.filaRepository.findOne({ where: { escala: { id: escalaId }, oficial: { id: oficialId }, status: StatusFila.ESCOLHENDO } });
    if (!turnoAtivo) throw new BadRequestException('Acesso negado: Não é o seu turno.');
    if (this.prazoVencido(turnoAtivo)) {
      throw new BadRequestException('Seu prazo de escolha venceu. Aguarde a decisão do escalante.');
    }

    const servico = await this.servicoRepository.findOne({
      where: { id: servicoId, escala: { id: escalaId } },
      relations: { oficial_dia: true, oficial_sobreaviso: true },
    });
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
