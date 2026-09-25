import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermutaService } from './permuta.service';
import { PermutaController } from './permuta.controller';
import { Permuta } from './entities/permuta.entity';
import { Servico } from '../servico/entities/servico.entity';
import { FilaEscolha } from '../fila-escolha/entities/fila-escolha.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permuta, Servico, FilaEscolha])
  ],
  controllers: [PermutaController],
  providers: [PermutaService],
})
export class PermutaModule {}
