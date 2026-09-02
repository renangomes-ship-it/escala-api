import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscalaService } from './escala.service';
import { EscalaController } from './escala.controller';
import { Escala } from './entities/escala.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Escala])],
  controllers: [EscalaController],
  providers: [EscalaService],
})
export class EscalaModule {}