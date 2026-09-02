import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OficialModule } from './oficial/oficial.module';
import { EscalaModule } from './escala/escala.module';
import { ServicoModule } from './servico/servico.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '92299085', 
      database: 'escala_bombeiros',
      autoLoadEntities: true, 
      synchronize: true, 
    }),
    OficialModule,
    EscalaModule,
    ServicoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}