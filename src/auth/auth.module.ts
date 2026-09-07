import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Oficial } from '../oficial/entities/oficial.entity';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Oficial]),
    PassportModule,
    JwtModule.register({
      secret: 'CHAVE_SECRETA_DO_SEU_SISTEMA', 
      signOptions: { expiresIn: '1d' }, // Tempo de expiração do token
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}