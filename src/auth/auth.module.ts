import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Oficial } from '../oficial/entities/oficial.entity';
import { JwtStrategy } from './jwt.strategy';
import {
  getOptionalEnvironment,
  getJwtSecret,
} from '../config/environment';

@Module({
  imports: [
    TypeOrmModule.forFeature([Oficial]),
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: {
        expiresIn: getOptionalEnvironment(
          'JWT_EXPIRES_IN',
          '1d',
        ) as JwtSignOptions['expiresIn'],
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
