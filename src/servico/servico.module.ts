import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoService } from './servico.service';
import { ServicoController } from './servico.controller';
import { Servico } from './entities/servico.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Servico])],
  controllers: [ServicoController],
  providers: [ServicoService],
})
export class ServicoModule {}
