import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoService } from './servico.service';
import { ServicoController } from './servico.controller';
import { Servico } from './entities/servico.entity';
import { Escala } from '../escala/entities/escala.entity';
import { FilaEscolha } from '../fila-escolha/entities/fila-escolha.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Servico, Escala, FilaEscolha])],
  controllers: [ServicoController],
  providers: [ServicoService],
})
export class ServicoModule {}
