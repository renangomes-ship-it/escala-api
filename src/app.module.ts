import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OficialModule } from './oficial/oficial.module';
import { EscalaModule } from './escala/escala.module';
import { ServicoModule } from './servico/servico.module';
import { FilaEscolhaModule } from './fila-escolha/fila-escolha.module';
import { AuthModule } from './auth/auth.module';
import { PermutaModule } from './permuta/permuta.module';

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
    FilaEscolhaModule,
    AuthModule,
    PermutaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}