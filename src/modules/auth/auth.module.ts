import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiKey } from './entities/api-key.entity';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { AuthController } from './auth.controller';
import { AuthValidateController } from './auth-validate.controller';
import { MeController } from './me.controller';
import { UserController } from './user.controller';
import { ApiKeyGuard } from './guards/api-key.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, User], 'main'),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signOptions: { expiresIn: (config.get<string>('jwt.expiresIn') || '1d') as any },
      }),
    }),
  ],
  controllers: [AuthController, AuthValidateController, MeController, UserController],
  providers: [
    AuthService,
    UserService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
  exports: [AuthService, UserService],
})
export class AuthModule {}
