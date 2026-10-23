import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Permuta, StatusPermuta } from './entities/permuta.entity';
import { Servico } from '../servico/entities/servico.entity';
import {
  FilaEscolha,
  StatusFila,
} from '../fila-escolha/entities/fila-escolha.entity';
import { CreatePermutaDto } from './dto/create-permuta.dto';
import { TrocaAdministrativaDto } from './dto/troca-administrativa.dto';
import { AjustarEscolhaDto } from './dto/ajustar-escolha.dto';
import { RealocarAdministrativaDto } from './dto/realocar-administrativa.dto';
import { Oficial } from '../oficial/entities/oficial.entity';

@Injectable()
export class PermutaService {
  constructor(
    @InjectRepository(Permuta) private permutaRepository: Repository<Permuta>,
    @InjectRepository(Servico) private servicoRepository: Repository<Servico>,
    @InjectRepository(FilaEscolha)
    private filaRepository: Repository<FilaEscolha>,
  ) {}

  private async obterServico(id: number, obm?: string) {
    const servico = await this.servicoRepository.findOne({
      where: { id },
      relations: { escala: true, oficial_dia: true, oficial_sobreaviso: true },
    });
    if (!servico || (obm && servico.escala.obm !== obm)) {
      throw new NotFoundException('Serviço não encontrado.');
    }
    if (servico.escala.status === 'ARQUIVADA') {
      if (obm) throw new NotFoundException('Serviço não encontrado.');
      throw new BadRequestException(
        'Uma escala arquivada não pode ser alterada.',
      );
    }
    return servico;
  }

  private async obterPermuta(id: number, obm?: string) {
    const permuta = await this.permutaRepository.findOne({
      where: { id },
      relations: {
        servico: { escala: true },
        oficial_sainte: true,
        oficial_entrante: true,
      },
    });
    if (!permuta || (obm && permuta.servico.escala.obm !== obm)) {
      throw new NotFoundException('Permuta não encontrada.');
    }
    if (permuta.servico.escala.status === 'ARQUIVADA') {
      if (obm) throw new NotFoundException('Permuta não encontrada.');
      throw new BadRequestException(
        'Uma escala arquivada não pode ser alterada.',
      );
    }
    return permuta;
  }

  private async obterGrupoTroca(grupoTroca: string, obm?: string) {
    const permutas = await this.permutaRepository.find({
      where: { grupo_troca: grupoTroca },
      relations: {
        servico: { escala: true },
        oficial_sainte: true,
        oficial_entrante: true,
      },
      order: { eh_contrapartida: 'ASC' },
    });
    if (
      permutas.length !== 2 ||
      (obm && permutas.some((item) => item.servico.escala.obm !== obm))
    ) {
      throw new BadRequestException(
        'O vínculo desta troca está incompleto ou é inválido.',
      );
    }
    if (permutas.some((item) => item.servico.escala.status === 'ARQUIVADA')) {
      if (obm) throw new NotFoundException('Permuta não encontrada.');
      throw new BadRequestException(
        'Uma escala arquivada não pode ser alterada.',
      );
    }
    return permutas;
  }

  private async validarOficialAptoNaEscala(
    escalaId: number,
    oficialId: number,
  ) {
    const registro = await this.filaRepository.findOne({
      where: {
        escala: { id: escalaId },
        oficial: { id: oficialId },
      },
    });
    if (registro?.observacao === 'INAPTO') {
      throw new BadRequestException(
        'Este oficial foi declarado inapto para esta escala e não pode receber serviços.',
      );
    }
    return registro;
  }

  async solicitarPermuta(
    dto: CreatePermutaDto & { entranteId: number },
    obm?: string,
  ) {
    const servico = await this.obterServico(dto.servicoId, obm);
    await this.validarOficialAptoNaEscala(servico.escala.id, dto.entranteId);
    const ocupanteAtual =
      dto.tipoVaga === 'DIA' ? servico.oficial_dia : servico.oficial_sobreaviso;

    if (!ocupanteAtual) {
      throw new BadRequestException(
        'A vaga selecionada não possui ocupante para solicitar uma permuta.',
      );
    }
    if (ocupanteAtual.id === dto.entranteId) {
      throw new BadRequestException('Você já ocupa esta vaga.');
    }
    const outroCampoAlvo =
      dto.tipoVaga === 'DIA' ? 'oficial_sobreaviso' : 'oficial_dia';
    if (servico[outroCampoAlvo]?.id === dto.entranteId) {
      throw new BadRequestException('Você já ocupa a outra função neste dia.');
    }

    const informouServico = dto.servicoOferecidoId !== undefined;
    const informouTipo = dto.tipoVagaOferecida !== undefined;
    if (informouServico !== informouTipo) {
      throw new BadRequestException(
        'Informe o serviço oferecido e a função correspondente.',
      );
    }

    const permuta = this.permutaRepository.create({
      servico: { id: dto.servicoId },
      tipo_vaga: dto.tipoVaga,
      oficial_sainte: { id: ocupanteAtual.id },
      oficial_entrante: { id: dto.entranteId },
      status: StatusPermuta.PENDENTE_ACORDO,
      criado_por: 'OFICIAL',
      justificativa: dto.justificativa,
      grupo_troca: null,
      eh_contrapartida: false,
    });

    if (!informouServico) return await this.permutaRepository.save(permuta);

    const servicoOferecido = await this.obterServico(
      dto.servicoOferecidoId!,
      obm,
    );
    const ocupanteOferecido =
      dto.tipoVagaOferecida === 'DIA'
        ? servicoOferecido.oficial_dia
        : servicoOferecido.oficial_sobreaviso;
    if (ocupanteOferecido?.id !== dto.entranteId) {
      throw new BadRequestException(
        'Você só pode oferecer um serviço que pertence a você.',
      );
    }
    if (
      servicoOferecido.escala.id !== servico.escala.id ||
      servicoOferecido.tipo_escala !== servico.tipo_escala ||
      dto.tipoVagaOferecida !== dto.tipoVaga
    ) {
      throw new BadRequestException(
        'A troca deve usar serviços da mesma escala, cor e função.',
      );
    }

    const outroCampoOferecido =
      dto.tipoVagaOferecida === 'DIA' ? 'oficial_sobreaviso' : 'oficial_dia';
    if (
      servico[outroCampoAlvo]?.id === dto.entranteId ||
      servicoOferecido[outroCampoOferecido]?.id === ocupanteAtual.id
    ) {
      throw new BadRequestException(
        'A troca colocaria um oficial nas duas funções do mesmo dia.',
      );
    }

    const grupoTroca = randomUUID();
    permuta.grupo_troca = grupoTroca;
    const contrapartida = this.permutaRepository.create({
      servico: { id: servicoOferecido.id },
      tipo_vaga: dto.tipoVagaOferecida,
      oficial_sainte: { id: dto.entranteId },
      oficial_entrante: { id: ocupanteAtual.id },
      status: StatusPermuta.PENDENTE_ACORDO,
      criado_por: 'OFICIAL',
      justificativa: dto.justificativa,
      grupo_troca: grupoTroca,
      eh_contrapartida: true,
    });
    return this.permutaRepository.manager.transaction((manager) =>
      manager.save(Permuta, [permuta, contrapartida]),
    );
  }

  async trocaAdministrativa(dto: TrocaAdministrativaDto, obm?: string) {
    const servico = await this.obterServico(dto.servicoId, obm);
    if (dto.entranteId) {
      await this.validarOficialAptoNaEscala(servico.escala.id, dto.entranteId);
    }

    const campoAlterado =
      dto.tipoVaga === 'DIA' ? 'oficial_dia' : 'oficial_sobreaviso';
    const outroCampo =
      dto.tipoVaga === 'DIA' ? 'oficial_sobreaviso' : 'oficial_dia';
    const ocupanteAtualId = servico[campoAlterado]?.id ?? null;
    if (ocupanteAtualId !== (dto.sainteId ?? null)) {
      throw new BadRequestException(
        'A ocupação desta vaga mudou. Atualize a grade antes de tentar novamente.',
      );
    }
    if (dto.entranteId && servico[outroCampo]?.id === dto.entranteId) {
      throw new BadRequestException(
        'O oficial não pode ocupar titular e sobreaviso no mesmo dia.',
      );
    }

    const escolhaEmAndamento = ['ABERTA', 'PENDENTE_AJUSTE_MANUAL'].includes(
      servico.escala.status,
    );
    if (escolhaEmAndamento && dto.sainteId !== dto.entranteId) {
      await this.validarCotasNaAlteracaoAdministrativa(
        servico,
        dto.tipoVaga,
        dto.sainteId ?? null,
        dto.entranteId ?? null,
      );
    }
    if (
      !escolhaEmAndamento &&
      dto.sainteId !== dto.entranteId &&
      !dto.justificativa?.trim()
    ) {
      throw new BadRequestException(
        'Informe a justificativa da alteração realizada depois do encerramento das escolhas.',
      );
    }

    if (dto.tipoVaga === 'DIA') {
      servico.oficial_dia = dto.entranteId
        ? ({ id: dto.entranteId } as Oficial)
        : (null as unknown as Oficial);
    } else {
      servico.oficial_sobreaviso = dto.entranteId
        ? ({ id: dto.entranteId } as Oficial)
        : (null as unknown as Oficial);
    }

    // Registra o histórico de auditoria sempre que houver uma alteração
    if (dto.sainteId !== dto.entranteId) {
      // 1. Cria a base do registro sem as relações problemáticas
      const registroHistorico = this.permutaRepository.create({
        servico: { id: dto.servicoId },
        tipo_vaga: dto.tipoVaga,
        status: StatusPermuta.ADMINISTRATIVA,
        criado_por: 'ESCALANTE',
        justificativa:
          dto.justificativa?.trim() ||
          'Alteração de ofício na grade durante a escolha.',
      });

      // 2. Injeta as relações "por fora" do create, onde o TypeScript aceita o null perfeitamente
      registroHistorico.oficial_sainte = dto.sainteId
        ? ({ id: dto.sainteId } as Oficial)
        : (null as unknown as Oficial);
      registroHistorico.oficial_entrante = dto.entranteId
        ? ({ id: dto.entranteId } as Oficial)
        : (null as unknown as Oficial);

      await this.servicoRepository.manager.transaction(async (manager) => {
        await manager.save(Servico, servico);
        await manager.save(Permuta, registroHistorico);
      });
    } else {
      await this.servicoRepository.save(servico);
    }

    return {
      mensagem: 'Grade atualizada com sucesso e registrada na auditoria.',
    };
  }

  private async validarCotasNaAlteracaoAdministrativa(
    servico: Servico,
    tipoVaga: 'DIA' | 'SOBREAVISO',
    sainteId: number | null,
    entranteId: number | null,
  ) {
    const idsAfetados = [
      ...new Set(
        [sainteId, entranteId].filter((id): id is number => id !== null),
      ),
    ];
    const campo = tipoVaga === 'DIA' ? 'oficial_dia' : 'oficial_sobreaviso';
    const chaveCota = `cota_${servico.tipo_escala.toLowerCase()}` as
      'cota_preta' | 'cota_roxa' | 'cota_vermelha';

    for (const oficialId of idsAfetados) {
      const registro = await this.filaRepository.findOne({
        where: {
          escala: { id: servico.escala.id },
          oficial: { id: oficialId },
        },
      });
      if (!registro) {
        throw new BadRequestException(
          'O oficial informado não pertence à fila desta escala.',
        );
      }

      const quantidadeAtual = await this.servicoRepository.count({
        where: {
          escala: { id: servico.escala.id },
          tipo_escala: servico.tipo_escala,
          [campo]: { id: oficialId },
        },
      });
      const variacao =
        (entranteId === oficialId ? 1 : 0) - (sainteId === oficialId ? 1 : 0);
      const quantidadeDepois = quantidadeAtual + variacao;
      const cota = registro[chaveCota];

      if (registro.status === StatusFila.FINALIZADO) {
        const desvioAtual = Math.abs(quantidadeAtual - cota);
        const desvioDepois = Math.abs(quantidadeDepois - cota);
        if (desvioDepois > 0 && desvioDepois >= desvioAtual) {
          throw new BadRequestException(
            quantidadeDepois > cota
              ? 'Este oficial já concluiu a cota desta cor e função. Durante a escolha, use a realocação para liberar um serviço equivalente.'
              : 'Esta alteração deixaria incompleta a cota de um oficial que já concluiu a escolha.',
          );
        }
      } else if (quantidadeDepois > cota) {
        throw new BadRequestException(
          'A alteração ultrapassaria a cota deste oficial para a cor e função selecionadas.',
        );
      }
    }
  }

  async realocarAdministrativamente(
    dto: RealocarAdministrativaDto,
    obm?: string,
  ) {
    if (dto.servicoOrigemId === dto.servicoDestinoId) {
      throw new BadRequestException(
        'Escolha dias diferentes para origem e destino.',
      );
    }
    const [origem, destino] = await Promise.all([
      this.obterServico(dto.servicoOrigemId, obm),
      this.obterServico(dto.servicoDestinoId, obm),
    ]);
    if (
      origem.escala.id !== destino.escala.id ||
      !['ABERTA', 'PENDENTE_AJUSTE_MANUAL'].includes(origem.escala.status)
    ) {
      throw new BadRequestException(
        'A realocação protegida só pode ocorrer dentro da mesma escala enquanto a escolha estiver em andamento.',
      );
    }
    if (origem.tipo_escala !== destino.tipo_escala) {
      throw new BadRequestException(
        'A origem e o destino da realocação precisam ter a mesma cor.',
      );
    }

    const campo = dto.tipoVaga === 'DIA' ? 'oficial_dia' : 'oficial_sobreaviso';
    const outroCampo =
      dto.tipoVaga === 'DIA' ? 'oficial_sobreaviso' : 'oficial_dia';
    if (origem[campo]?.id !== dto.oficialId || destino[campo]) {
      throw new BadRequestException(
        'A origem precisa pertencer ao oficial e o destino precisa estar livre.',
      );
    }
    if (destino[outroCampo]?.id === dto.oficialId) {
      throw new BadRequestException(
        'O oficial não pode ocupar titular e sobreaviso no mesmo dia.',
      );
    }

    const registro = await this.filaRepository.findOne({
      where: {
        escala: { id: origem.escala.id },
        oficial: { id: dto.oficialId },
        status: StatusFila.FINALIZADO,
      },
    });
    if (!registro) {
      throw new BadRequestException(
        'A realocação protegida está disponível apenas para quem já concluiu a escolha.',
      );
    }
    if (registro.observacao === 'INAPTO') {
      throw new BadRequestException(
        'Este oficial foi declarado inapto para esta escala e não pode receber serviços.',
      );
    }
    const chaveCota = `cota_${origem.tipo_escala.toLowerCase()}` as
      'cota_preta' | 'cota_roxa' | 'cota_vermelha';
    const quantidadeAtual = await this.servicoRepository.count({
      where: {
        escala: { id: origem.escala.id },
        tipo_escala: origem.tipo_escala,
        [campo]: { id: dto.oficialId },
      },
    });
    if (quantidadeAtual !== registro[chaveCota]) {
      throw new BadRequestException(
        'A distribuição deste oficial já diverge da cota. Corrija o excesso ou a falta antes de realocar.',
      );
    }

    origem[campo] = null as unknown as Oficial;
    destino[campo] = { id: dto.oficialId } as Oficial;
    const liberacao = this.permutaRepository.create({
      servico: { id: origem.id },
      tipo_vaga: dto.tipoVaga,
      status: StatusPermuta.ADMINISTRATIVA,
      criado_por: 'ESCALANTE',
      justificativa:
        'Serviço liberado em realocação administrativa durante a escolha.',
    });
    liberacao.oficial_sainte = { id: dto.oficialId } as Oficial;
    liberacao.oficial_entrante = null as unknown as Oficial;
    const assuncao = this.permutaRepository.create({
      servico: { id: destino.id },
      tipo_vaga: dto.tipoVaga,
      status: StatusPermuta.ADMINISTRATIVA,
      criado_por: 'ESCALANTE',
      justificativa:
        'Vaga assumida em realocação administrativa durante a escolha.',
    });
    assuncao.oficial_sainte = null as unknown as Oficial;
    assuncao.oficial_entrante = { id: dto.oficialId } as Oficial;

    await this.servicoRepository.manager.transaction(async (manager) => {
      await manager.save(Servico, [origem, destino]);
      await manager.save(Permuta, [liberacao, assuncao]);
    });
    return {
      mensagem:
        'Serviço realocado sem alterar as cotas e registrado na auditoria.',
    };
  }

  async responderPermuta(
    id: number,
    acao: 'SIM' | 'NAO',
    respondidoPor: 'OFICIAL_ENVOLVIDO' | 'ESCALANTE',
    justificativa?: string,
    obm?: string,
  ) {
    const permuta = await this.obterPermuta(id, obm);
    if (
      respondidoPor === 'ESCALANTE' &&
      acao === 'NAO' &&
      !justificativa?.trim()
    ) {
      throw new BadRequestException('O motivo do indeferimento é obrigatório.');
    }

    if (permuta.grupo_troca) {
      const grupo = await this.obterGrupoTroca(permuta.grupo_troca, obm);
      if (
        grupo.some((item) => item.status !== StatusPermuta.PENDENTE_APROVACAO)
      ) {
        throw new BadRequestException(
          'As duas movimentações precisam aguardar aprovação do escalante.',
        );
      }
      const novoStatus =
        acao === 'SIM' ? StatusPermuta.APROVADA : StatusPermuta.INDEFERIDA;
      for (const item of grupo) {
        item.status = novoStatus;
        if (justificativa) item.justificativa = justificativa;
      }

      await this.permutaRepository.manager.transaction(async (manager) => {
        if (acao === 'SIM') {
          await Promise.all(
            grupo.map((item) =>
              this.validarOficialAptoNaEscala(
                item.servico.escala.id,
                item.oficial_entrante.id,
              ),
            ),
          );
          const servicos = await Promise.all(
            grupo.map((item) => this.obterServico(item.servico.id, obm)),
          );
          for (let indice = 0; indice < grupo.length; indice += 1) {
            const item = grupo[indice];
            const servicoGrupo = servicos[indice];
            const ocupanteAtual =
              item.tipo_vaga === 'DIA'
                ? servicoGrupo.oficial_dia
                : servicoGrupo.oficial_sobreaviso;
            if (ocupanteAtual?.id !== item.oficial_sainte.id) {
              throw new BadRequestException(
                'A ocupação de um dos serviços mudou depois da solicitação. A troca não pode ser efetivada.',
              );
            }
            if (item.tipo_vaga === 'DIA') {
              servicoGrupo.oficial_dia = {
                id: item.oficial_entrante.id,
              } as Oficial;
            } else {
              servicoGrupo.oficial_sobreaviso = {
                id: item.oficial_entrante.id,
              } as Oficial;
            }
          }
          await manager.save(Servico, servicos);
        }
        await manager.save(Permuta, grupo);
      });
      return grupo;
    }

    if (
      respondidoPor === 'ESCALANTE' &&
      permuta.status !== StatusPermuta.PENDENTE_APROVACAO
    ) {
      throw new BadRequestException(
        'A permuta precisa ser aceita pelo oficial entrante antes da aprovação.',
      );
    }

    if (respondidoPor === 'OFICIAL_ENVOLVIDO') {
      permuta.status =
        acao === 'SIM'
          ? StatusPermuta.PENDENTE_APROVACAO
          : StatusPermuta.RECUSADA;
    } else if (respondidoPor === 'ESCALANTE') {
      permuta.status =
        acao === 'SIM' ? StatusPermuta.APROVADA : StatusPermuta.INDEFERIDA;

      if (acao === 'SIM') {
        const servico = await this.obterServico(permuta.servico.id, obm);
        await this.validarOficialAptoNaEscala(
          servico.escala.id,
          permuta.oficial_entrante.id,
        );
        const ocupanteAtual =
          permuta.tipo_vaga === 'DIA'
            ? servico.oficial_dia
            : servico.oficial_sobreaviso;
        if (ocupanteAtual?.id !== permuta.oficial_sainte.id) {
          throw new BadRequestException(
            'A ocupação do serviço mudou depois da solicitação. A permuta não pode ser efetivada.',
          );
        }

        if (permuta.tipo_vaga === 'DIA') {
          servico.oficial_dia = {
            id: permuta.oficial_entrante.id,
          } as Oficial;
        } else {
          servico.oficial_sobreaviso = {
            id: permuta.oficial_entrante.id,
          } as Oficial;
        }
        await this.servicoRepository.save(servico);
      }
    }

    if (justificativa) permuta.justificativa = justificativa;

    return await this.permutaRepository.save(permuta);
  }

  async ajustarEscolha(
    dto: AjustarEscolhaDto,
    oficialId: number,
    obm?: string,
  ) {
    const [origem, destino] = await Promise.all([
      this.obterServico(dto.servicoOrigemId, obm),
      this.obterServico(dto.servicoDestinoId, obm),
    ]);
    if (
      origem.escala.id !== destino.escala.id ||
      origem.escala.status !== 'ABERTA'
    ) {
      throw new BadRequestException(
        'O ajuste só pode ocorrer dentro de uma escala aberta.',
      );
    }
    if (origem.tipo_escala !== destino.tipo_escala) {
      throw new BadRequestException(
        'O serviço de origem e a vaga livre precisam ter a mesma cor.',
      );
    }
    const campoOrigem =
      dto.tipoVagaOrigem === 'DIA' ? 'oficial_dia' : 'oficial_sobreaviso';
    const campoDestino =
      dto.tipoVagaDestino === 'DIA' ? 'oficial_dia' : 'oficial_sobreaviso';
    if (origem[campoOrigem]?.id !== oficialId || destino[campoDestino]) {
      throw new BadRequestException(
        'Informe um serviço seu e uma vaga realmente livre.',
      );
    }
    const outroCampoDestino =
      campoDestino === 'oficial_dia' ? 'oficial_sobreaviso' : 'oficial_dia';
    if (destino[outroCampoDestino]?.id === oficialId) {
      throw new BadRequestException(
        'O oficial não pode ocupar as duas funções no mesmo dia.',
      );
    }
    const turno = await this.filaRepository.findOne({
      where: {
        escala: { id: origem.escala.id },
        oficial: { id: oficialId },
        status: StatusFila.FINALIZADO,
      },
    });
    if (!turno) {
      throw new BadRequestException(
        'Somente oficial que já concluiu a escolha pode ajustar um serviço.',
      );
    }

    origem[campoOrigem] = null as unknown as Oficial;
    destino[campoDestino] = { id: oficialId } as Oficial;
    const servicosDoOficial = await this.servicoRepository.find({
      where: { escala: { id: origem.escala.id } },
      relations: { oficial_dia: true, oficial_sobreaviso: true },
    });
    const origemNaLista = servicosDoOficial.find(
      (servico) => servico.id === origem.id,
    );
    const destinoNaLista = servicosDoOficial.find(
      (servico) => servico.id === destino.id,
    );
    if (!origemNaLista || !destinoNaLista) {
      throw new NotFoundException(
        'Não foi possível validar os serviços da escala.',
      );
    }
    origemNaLista[campoOrigem] = null as unknown as Oficial;
    destinoNaLista[campoDestino] = { id: oficialId } as Oficial;
    const cotas = {
      PRETA: turno.cota_preta,
      ROXA: turno.cota_roxa,
      VERMELHA: turno.cota_vermelha,
    };
    for (const cor of Object.keys(cotas)) {
      const titulares = servicosDoOficial.filter(
        (servico) =>
          servico.tipo_escala === cor && servico.oficial_dia?.id === oficialId,
      ).length;
      const sobreavisos = servicosDoOficial.filter(
        (servico) =>
          servico.tipo_escala === cor &&
          servico.oficial_sobreaviso?.id === oficialId,
      ).length;
      if (titulares !== cotas[cor] || sobreavisos !== cotas[cor]) {
        throw new BadRequestException(
          'O ajuste alteraria a distribuição obrigatória de cotas.',
        );
      }
    }
    const liberacao = this.permutaRepository.create({
      servico: { id: origem.id },
      tipo_vaga: dto.tipoVagaOrigem,
      status: StatusPermuta.ADMINISTRATIVA,
      criado_por: 'OFICIAL',
      justificativa: 'Serviço liberado em ajuste imediato para vaga livre.',
    });
    liberacao.oficial_sainte = { id: oficialId } as Oficial;
    liberacao.oficial_entrante = null as unknown as Oficial;

    const assuncao = this.permutaRepository.create({
      servico: { id: destino.id },
      tipo_vaga: dto.tipoVagaDestino,
      status: StatusPermuta.ADMINISTRATIVA,
      criado_por: 'OFICIAL',
      justificativa: 'Vaga livre assumida em ajuste imediato de escolha.',
    });
    assuncao.oficial_sainte = null as unknown as Oficial;
    assuncao.oficial_entrante = { id: oficialId } as Oficial;

    await this.servicoRepository.manager.transaction(async (manager) => {
      await manager.save(Servico, [origem, destino]);
      await manager.save(Permuta, [liberacao, assuncao]);
    });
    return { mensagem: 'Escolha ajustada e registrada no histórico.' };
  }

  async responderComoOficial(
    id: number,
    oficialId: number,
    acao: 'SIM' | 'NAO',
    justificativa?: string,
    obm?: string,
  ) {
    const permuta = await this.obterPermuta(id, obm);
    if (permuta.eh_contrapartida) {
      throw new BadRequestException(
        'Responda pela movimentação principal desta troca.',
      );
    }
    if (permuta.grupo_troca) {
      if (permuta.status !== StatusPermuta.PENDENTE_ACORDO) {
        throw new BadRequestException(
          'Esta troca não está aguardando o aceite do oficial destinatário.',
        );
      }
      if (permuta.oficial_sainte.id !== oficialId) {
        throw new BadRequestException(
          'Somente o destinatário da troca pode responder.',
        );
      }
      const grupo = await this.obterGrupoTroca(permuta.grupo_troca, obm);
      if (grupo.some((item) => item.status !== StatusPermuta.PENDENTE_ACORDO)) {
        throw new BadRequestException(
          'As movimentações desta troca não estão no mesmo estado.',
        );
      }
      const novoStatus =
        acao === 'SIM'
          ? StatusPermuta.PENDENTE_APROVACAO
          : StatusPermuta.RECUSADA;
      for (const item of grupo) {
        item.status = novoStatus;
        if (justificativa) item.justificativa = justificativa;
      }
      return this.permutaRepository.manager.transaction((manager) =>
        manager.save(Permuta, grupo),
      );
    }
    if (permuta.status !== StatusPermuta.PENDENTE_ACORDO) {
      throw new BadRequestException(
        'Esta permuta não está aguardando o aceite do oficial entrante.',
      );
    }
    if (permuta.oficial_sainte.id !== oficialId) {
      throw new BadRequestException(
        'Somente o ocupante atual da vaga pode responder esta permuta.',
      );
    }

    permuta.status =
      acao === 'SIM'
        ? StatusPermuta.PENDENTE_APROVACAO
        : StatusPermuta.RECUSADA;
    if (justificativa) permuta.justificativa = justificativa;
    return this.permutaRepository.save(permuta);
  }

  async findAll(obm?: string) {
    return await this.permutaRepository.find({
      where: obm
        ? { servico: { escala: { obm, status: Not('ARQUIVADA') } } }
        : {},
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

  async publicarPermutas(ids: number[], boletim: string, obm?: string) {
    if (!ids || ids.length === 0)
      throw new BadRequestException('Nenhuma permuta selecionada.');

    const idsUnicos = [...new Set(ids)];
    const permutas = await Promise.all(
      idsUnicos.map((id) => this.obterPermuta(id, obm)),
    );
    for (const permuta of permutas) {
      permuta.boletim_interno = boletim;
    }
    await this.permutaRepository.save(permutas);
    return { mensagem: 'Permutas publicadas com sucesso.' };
  }

  async findByOficial(oficialId: number, obm?: string) {
    const permutas = await this.findAll(obm);
    return permutas.filter(
      (permuta) =>
        permuta.oficial_sainte?.id === oficialId ||
        permuta.oficial_entrante?.id === oficialId,
    );
  }
}
