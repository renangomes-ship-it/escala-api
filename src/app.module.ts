import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OficialModule } from './oficial/oficial.module';
import { EscalaModule } from './escala/escala.module';
import { ServicoModule } from './servico/servico.module';
import { FilaEscolhaModule } from './fila-escolha/fila-escolha.module';
import { AuthModule } from './auth/auth.module';
import { PermutaModule } from './permuta/permuta.module';
import { UnidadeModule } from './unidade/unidade.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { PasswordChangeRequiredGuard } from './auth/guards/password-change-required.guard';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuditoriaInterceptor } from './auditoria/auditoria.interceptor';
import { RelatorioModule } from './relatorio/relatorio.module';
import { Oficial } from './oficial/entities/oficial.entity';
import {
  getEnvironmentPort,
  getRequiredEnvironment,
} from './config/environment';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: getRequiredEnvironment('DB_HOST'),
      port: getEnvironmentPort('DB_PORT'),
      username: getRequiredEnvironment('DB_USERNAME'),
      password: getRequiredEnvironment('DB_PASSWORD'),
      database: getRequiredEnvironment('DB_DATABASE'),
      autoLoadEntities: true,
      synchronize: false,
    }),
    TypeOrmModule.forFeature([Oficial]),
    OficialModule,
    EscalaModule,
    ServicoModule,
    FilaEscolhaModule,
    AuthModule,
    PermutaModule,
    UnidadeModule,
    AuditoriaModule,
    RelatorioModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeRequiredGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
  ],
})
export class AppModule {}
