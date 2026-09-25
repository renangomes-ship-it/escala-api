import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OficialService } from './oficial.service';
import { OficialController } from './oficial.controller';
import { Oficial } from './entities/oficial.entity';
import { UnidadeModule } from '../unidade/unidade.module';

@Module({
  imports: [TypeOrmModule.forFeature([Oficial]), UnidadeModule],
  controllers: [OficialController],
  providers: [OficialService],
})
export class OficialModule {}
