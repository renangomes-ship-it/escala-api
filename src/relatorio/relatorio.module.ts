import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escala } from '../escala/entities/escala.entity';
import { Permuta } from '../permuta/entities/permuta.entity';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';

@Module({
  imports: [TypeOrmModule.forFeature([Escala, Permuta])],
  controllers: [RelatorioController],
  providers: [RelatorioService],
})
export class RelatorioModule {}
