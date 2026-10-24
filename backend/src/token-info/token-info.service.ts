import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { TokenInfo } from '../db/entities/token-info.entity';

dayjs.extend(utc);

const SYNC_TIME_FRAME = 'all';

interface UserToken {
  coinName: string;
  unit: string;
  tokenInfoId: number;
}

@Injectable()
export class TokenInfoService {
  private readonly logger = new Logger(TokenInfoService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  // Distinct (coinName, unit, token_id) triples the user has transacted in. A raw join
  // mirrors dbService.ts's `$queryRaw` verbatim - MikroORM has no first-class API for
  // joining on a non-FK column pair (Transaction.unit = TokenInfo.symbol).
  async getTokensForUserId(userId: number): Promise<UserToken[]> {
    return (await this.em.getConnection().execute(
      /* SQL */ `
      SELECT DISTINCT
         trans.coinName AS coinName,
         trans.unit AS unit,
         tokenInfo.token_id AS tokenInfoId
       FROM Transaction AS trans
       JOIN TokenInfo AS tokenInfo
         ON trans.unit = tokenInfo.symbol
       WHERE trans.userId = ?`,
      [userId],
    )) as UserToken[];
  }

  async searchTokenInfo(searchTerm: string): Promise<TokenInfo[]> {
    return this.em.getRepository(TokenInfo).find(
      {
        $or: [{ name: { $like: `${searchTerm}%` } }, { symbol: { $like: `${searchTerm}%` } }],
      },
      { limit: 10 },
    );
  }

  async syncPriceHistoryForUser(userId: number): Promise<void> {
    const tokens = await this.getTokensForUserId(userId);

    for (const token of tokens) {
      let prices: [number, number, number][];
      try {
        prices = (
          await this.exchangeRatesService.getPriceHistoryForTimeFrame(
            token.coinName,
            SYNC_TIME_FRAME,
          )
        ).prices;
      } catch (error) {
        this.logger.error({
          message: 'Error fetching/storing price history',
          coinName: token.coinName,
          error,
        });
        throw error;
      }

      if (prices.length === 0) {
        continue;
      }

      // Destructures index 1, not 2, of the [unixTimestamp, openPrice, closePrice]
      // tuple - the same off-by-one as update-price-history.ts:250-255, reproduced
      // for parity rather than silently fixed.
      const values = prices.flatMap(([unixTimestamp, closePrice]) => [
        SYNC_TIME_FRAME,
        closePrice.toFixed(2),
        dayjs.unix(unixTimestamp).utc().format('YYYY-MM-DD HH:mm:ss'),
        token.tokenInfoId,
      ]);
      const placeholders = prices.map(() => '(?, ?, ?, ?)').join(', ');

      // INSERT IGNORE tolerates the composite-PK collision a re-sync produces;
      // em.create()/flush() would throw on it instead.
      await this.em.getConnection().execute(
        /* SQL */ `
          INSERT IGNORE INTO TokenPriceHistory (timeFrame, close_price, date, token_info_id)
          VALUES ${placeholders}`,
        values,
      );
    }
  }
}
