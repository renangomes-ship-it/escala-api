import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OficialModule } from './oficial/oficial.module';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}