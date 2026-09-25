import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { FilaEscolhaService } from '../fila-escolha/fila-escolha.service';
import { Oficial } from '../oficial/entities/oficial.entity';
import { Escala } from './entities/escala.entity';
import { EscalaService } from './escala.service';
import { PrepararEscalaDto } from './dto/preparar-escala.dto';

@Injectable()
export class PreparacaoEscalaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly escalaService: EscalaService,
    private readonly filaEscolhaService: FilaEscolhaService,
  ) {}

  async preparar(dto: PrepararEscalaDto, obm: string) {
    return this.dataSource.transaction(async (manager) => {
      const escalaExistente = await manager.getRepository(Escala).findOne({
        where: { obm, mes: dto.escala.mes, ano: dto.escala.ano },
      });
      if (escalaExistente) {
        throw new BadRequestException(
          'Já existe uma escala cadastrada para esta unidade e período.',
        );
      }

      const idsInformados = [
        ...new Set(dto.dadosFila.map((item) => item.oficialId)),
      ];
      const oficiais = await manager.getRepository(Oficial).find({
        where: { id: In(idsInformados), obm, ativo: true },
      });
      if (oficiais.length !== idsInformados.length) {
        throw new BadRequestException(
          'A fila contém oficial inexistente, inativo ou de outra unidade.',
        );
      }

      const escala = await this.escalaService.create(
        { ...dto.escala, obm },
        manager,
      );
      await this.filaEscolhaService.gerarFila(
        escala.id,
        dto.dadosFila,
        obm,
        manager,
      );

      return {
        id: escala.id,
        mensagem: 'Escala, serviços e fila criados com sucesso.',
      };
    });
  }
}
