import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscalaService } from './escala.service';
import { EscalaController } from './escala.controller';
import { Escala } from './entities/escala.entity';
import { UnidadeModule } from '../unidade/unidade.module';
import { FilaEscolhaModule } from '../fila-escolha/fila-escolha.module';
import { PreparacaoEscalaService } from './preparacao-escala.service';

@Module({
  imports: [TypeOrmModule.forFeature([Escala]), UnidadeModule, FilaEscolhaModule],
  controllers: [EscalaController],
  providers: [EscalaService, PreparacaoEscalaService],
})
export class EscalaModule {}
