import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import axios from 'axios';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis';
import { CLOCK, Clock } from '../common/clock/clock';
import { ExchangeRate } from '../db/entities/exchange-rate.entity';
import { TIME_FRAMES } from '../common/time-frame/time-frames';
import { MetricsService } from '../metrics/metrics.service';
import { PriceHistoryResponseDto } from './dto/price-history-response.dto';

const EXCHANGE_RATE_CACHE_KEY = 'exchange-rates-last-updated';
const EXCHANGE_RATE_CACHE_TTL = 15; // seconds

const minute = 60;
const hour = 60 * minute;
const day = hour * 24;

// The one place this table is declared - price-history's `POST /price-history/set`
// (5.4) writes with the same TTLs and imports this rather than re-declaring it.
export const CACHE_EXPIRATION_BY_TIME_FRAME: Record<string, number> = {
  h: 10 * minute,
  d: 1 * hour,
  w: 1 * day,
  m: 1 * day,
  '3m': 1 * day,
  '6m': 1 * day,
  y: 1 * day,
  all: 1 * day,
};

interface CoinbaseExchangeRatesResponse {
  data: { rates: Record<string, string> };
}

@Injectable()
export class ExchangeRatesService {
  // Instance field, not a per-call local: the service is a singleton provider, so
  // concurrent refreshRates() calls within this process await the same in-flight
  // update rather than racing it.
  private inflightUpdate: Promise<void> | null = null;

  constructor(
    private readonly em: EntityManager,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly metricsService: MetricsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async refreshRates(): Promise<void> {
    if (this.inflightUpdate) {
      await this.inflightUpdate;
      return;
    }

    const lastUpdated = await this.redis.get(EXCHANGE_RATE_CACHE_KEY);
    if (lastUpdated) {
      return;
    }

    this.inflightUpdate = this.doUpdateExchangeRates().finally(() => {
      this.inflightUpdate = null;
    });
    return this.inflightUpdate;
  }

  private async doUpdateExchangeRates(): Promise<void> {
    // Set the cache key first so requests in *other* process instances also skip
    // re-fetching during the TTL window.
    await this.redis.setex(EXCHANGE_RATE_CACHE_KEY, EXCHANGE_RATE_CACHE_TTL, '1');

    this.metricsService.externalApiCallsCounter.inc({ api: 'coinbase' });
    const { data } = await axios.get<CoinbaseExchangeRatesResponse>(
      'https://api.coinbase.com/v2/exchange-rates',
    );
    const rates = data.data.rates;

    const heldUnitRows = (await this.em
      .getConnection()
      .execute('SELECT DISTINCT unit FROM PORTFOLIO.Transaction')) as { unit: string }[];
    const heldUnits: string[] = heldUnitRows.map((row) => row.unit);

    const rows = Object.entries(rates)
      .map(([unit, rate]) => ({ unit, rate: 1 / Number(rate) }))
      .filter(({ unit }) => heldUnits.includes(unit));

    // One shared timestamp for the whole batch: a per-row timestamp would let
    // MAX(date) see a partially-updated set.
    const nowDate = this.clock.now();

    await this.em.transactional(async (em) => {
      for (const { unit, rate } of rows) {
        await em
          .getConnection()
          .execute(
            'INSERT INTO ExchangeRate (date, unit, rate) VALUES (?, ?, ?) ' +
              'ON DUPLICATE KEY UPDATE date = VALUES(date), rate = VALUES(rate)',
            [nowDate, unit, rate],
            'run',
            em.getTransactionContext(),
          );
      }
    });
  }

  async getPriceHistoryForTimeFrame(
    coinName: string,
    timeFrame: string,
  ): Promise<PriceHistoryResponseDto> {
    if (
      !coinName ||
      !timeFrame ||
      typeof timeFrame !== 'string' ||
      typeof coinName !== 'string' ||
      !(TIME_FRAMES as readonly string[]).includes(timeFrame)
    ) {
      throw new Error('coinName and timeFrame are required');
    }

    const cacheKey = `time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}`;
    const cacheValue = await this.redis.get(cacheKey);

    if (!cacheValue) {
      this.metricsService.redisCacheResultsCounter.inc({
        cache_key_prefix: 'price_history',
        result: 'miss',
      });
      throw new Error('Cache miss getPriceHistoryForTimeFrame');
    }

    this.metricsService.redisCacheResultsCounter.inc({
      cache_key_prefix: 'price_history',
      result: 'hit',
    });
    return JSON.parse(cacheValue) as PriceHistoryResponseDto;
  }

  async getRateForUnit(unit: string): Promise<ExchangeRate | null> {
    return this.em.getRepository(ExchangeRate).findOne({ unit });
  }
}
