import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  // Validated once at construction, so it's exposed as a non-optional field. Optional
  // config below stays a getter typed `string | undefined`.
  readonly databaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is missing or empty - check defaults.env/override.env');
    }
    this.databaseUrl = databaseUrl;
  }

  get metricsSecret(): string | undefined {
    return this.configService.get<string>('METRICS_SECRET');
  }

  get priceProvider(): string | undefined {
    return this.configService.get<string>('PRICE_PROVIDER');
  }
}
