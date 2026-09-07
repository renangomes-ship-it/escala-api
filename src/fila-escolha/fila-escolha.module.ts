import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilaEscolhaService } from './fila-escolha.service';
import { FilaEscolhaController } from './fila-escolha.controller';
import { FilaEscolha } from './entities/fila-escolha.entity';
import { Servico } from '../servico/entities/servico.entity'; 

@Module({
  imports: [TypeOrmModule.forFeature([FilaEscolha, Servico])], 
  controllers: [FilaEscolhaController],
  providers: [FilaEscolhaService],
})
export class FilaEscolhaModule {}