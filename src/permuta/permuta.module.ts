import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermutaService } from './permuta.service';
import { PermutaController } from './permuta.controller';
import { Permuta } from './entities/permuta.entity';
import { Servico } from '../servico/entities/servico.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permuta, Servico])
  ],
  controllers: [PermutaController],
  providers: [PermutaService],
})
export class PermutaModule {}