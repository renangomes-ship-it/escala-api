import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Unidade } from './entities/unidade.entity';
import { UnidadeController } from './unidade.controller';
import { UnidadeService } from './unidade.service';

@Module({
  imports: [TypeOrmModule.forFeature([Unidade])],
  controllers: [UnidadeController],
  providers: [UnidadeService],
  exports: [UnidadeService],
})
export class UnidadeModule {}
