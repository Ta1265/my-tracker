import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  // Validated once at construction, so it's exposed as a non-optional field. Optional
  // config below stays a getter typed `string | undefined`.
  readonly databaseUrl: string;
  readonly sessionPrivateKeyJwk: string;
  readonly sessionPublicKeyJwk: string;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is missing or empty - check defaults.env/override.env');
    }
    this.databaseUrl = databaseUrl;

    const sessionPrivateKeyJwk = this.configService.get<string>('SESSION_PRIVATE_KEY_JWK');
    if (!sessionPrivateKeyJwk) {
      throw new Error(
        'SESSION_PRIVATE_KEY_JWK is missing or empty - check defaults.env/override.env',
      );
    }
    this.sessionPrivateKeyJwk = sessionPrivateKeyJwk;

    const sessionPublicKeyJwk = this.configService.get<string>('SESSION_PUBLIC_KEY_JWK');
    if (!sessionPublicKeyJwk) {
      throw new Error(
        'SESSION_PUBLIC_KEY_JWK is missing or empty - check defaults.env/override.env',
      );
    }
    this.sessionPublicKeyJwk = sessionPublicKeyJwk;
  }

  get metricsSecret(): string | undefined {
    return this.configService.get<string>('METRICS_SECRET');
  }

  get priceProvider(): string | undefined {
    return this.configService.get<string>('PRICE_PROVIDER');
  }

  // Defaults to true when unset - a flag, not a NODE_ENV check, so it can be turned
  // off without a rebuild.
  get swaggerEnabled(): boolean {
    return this.configService.get<string>('SWAGGER_ENABLED') !== 'false';
  }
}
