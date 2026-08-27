import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis';
import { TIME_FRAMES } from '../common/time-frame/time-frames';
import { CACHE_EXPIRATION_BY_TIME_FRAME } from '../exchange-rates/exchange-rates.service';
import { PriceHistoryResponseDto } from '../exchange-rates/dto/price-history-response.dto';
import { MetricsService } from '../metrics/metrics.service';
import { PriceHistoryCheckResponseDto } from './dto/price-history-check-response.dto';

@Injectable()
export class PriceHistoryService {
  constructor(
    private readonly em: EntityManager,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly metricsService: MetricsService,
  ) {}

  async checkCoverage(userId: number): Promise<PriceHistoryCheckResponseDto[]> {
    const coins = (await this.em
      .getConnection()
      .execute('SELECT DISTINCT coinName FROM PORTFOLIO.Transaction WHERE userId = ?', [
        userId,
      ])) as { coinName: string }[];

    return Promise.all(
      coins.map(async ({ coinName }) => {
        const timeFramesNeeded: string[] = [];
        await Promise.all(
          TIME_FRAMES.map(async (timeFrame) => {
            const cacheKey =
              `time-frame-pl-${timeFrame.toLowerCase()}-` + `coinName-${coinName.toLowerCase()}`;
            const exists = await this.redis.exists(cacheKey);
            this.metricsService.redisCacheResultsCounter.inc({
              cache_key_prefix: 'price_history',
              result: exists ? 'hit' : 'miss',
            });
            if (!exists) timeFramesNeeded.push(timeFrame);
          }),
        );
        return { coinName, timeFramesNeeded };
      }),
    );
  }

  async setEntry(
    coinName: string,
    timeFrame: string,
    priceHistoryResp: PriceHistoryResponseDto,
  ): Promise<string> {
    if (!coinName || !timeFrame || !priceHistoryResp) {
      throw new BadRequestException('Missing required fields');
    }

    const cacheKey =
      `time-frame-pl-${timeFrame.toLowerCase()}-` + `coinName-${coinName.toLowerCase()}`;
    await this.redis.setex(
      cacheKey,
      CACHE_EXPIRATION_BY_TIME_FRAME[timeFrame],
      JSON.stringify(priceHistoryResp),
    );

    return `Price history cached successfully: ${coinName} - ${timeFrame}`;
  }
}
