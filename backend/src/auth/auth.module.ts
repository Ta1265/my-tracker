import { createPrivateKey, createPublicKey, JsonWebKey } from 'node:crypto';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SESSION_ALGORITHM } from '@portfolio/shared';
import { AppConfigService } from '../config/app-config.service';
import { AuthController } from './auth.controller';
import { CredentialVerifierService } from './credential-verifier.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        privateKey: createPrivateKey({
          key: JSON.parse(config.sessionPrivateKeyJwk) as JsonWebKey,
          format: 'jwk',
        }),
        publicKey: createPublicKey({
          key: JSON.parse(config.sessionPublicKeyJwk) as JsonWebKey,
          format: 'jwk',
        }),
        signOptions: { algorithm: SESSION_ALGORITHM },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [CredentialVerifierService, SessionService, SessionGuard],
  exports: [SessionService, SessionGuard],
})
export class AuthModule {}
