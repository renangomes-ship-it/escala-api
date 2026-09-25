import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilaEscolhaService } from './fila-escolha.service';
import { FilaEscolhaController } from './fila-escolha.controller';
import { FilaEscolha } from './entities/fila-escolha.entity';
import { Servico } from '../servico/entities/servico.entity'; 
import { Escala } from '../escala/entities/escala.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FilaEscolha, Servico, Escala])],
  controllers: [FilaEscolhaController],
  providers: [FilaEscolhaService],
  exports: [FilaEscolhaService],
})
export class FilaEscolhaModule {}
