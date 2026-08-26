import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OficialService } from './oficial.service';
import { OficialController } from './oficial.controller';
import { Oficial } from './entities/oficial.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Oficial])],
  controllers: [OficialController],
  providers: [OficialService],
})
export class OficialModule {}