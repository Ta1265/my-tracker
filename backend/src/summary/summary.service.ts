import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { MetricsService } from '../metrics/metrics.service';
import { TokenInfoService } from '../token-info/token-info.service';
import { CoinSummaryResponseDto } from './dto/coin-summary-response.dto';
import { PortfolioSummaryResponseDto } from './dto/portfolio-summary-response.dto';
import { ProfitLossChartResponseDto } from './dto/profit-loss-chart-response.dto';

dayjs.extend(utc);
dayjs.extend(isSameOrBefore);

const NET_CASH_FLOW_HISTORY_CACHE_TTL = 3600;

export interface CoinSummary {
  productName: string;
  coinName: string;
  currentPrice: number;
  countBuys: number;
  countSells: number;
  totalBuyQuantity: number;
  totalSellQuantity: number;
  totalBuyCost: number;
  totalSellProfits: number;
  holdings: number;
  avgPurchasePrice: number;
  avgSellPrice: number;
  valueOfHoldings: number;
  profitLossAtCurrentPrice: number;
  breakEvenPrice: number;
  percentPL: number;
}

export interface PortfolioSummary {
  costBasis: number;
  totalBuyCost: number;
  totalSellProfits: number;
  valueOfHoldings: number;
  profitLoss: number;
}

export interface BuySellFiFoRow {
  token_info_id: string;
  unit: string;
  side: 'BUY' | 'SELL';
  total: number;
  date: Date;
  size: number;
}

interface UnitNetMap {
  [unit: string]: { netCashHoldings: number; netContributions: number };
}

interface TokenPriceDate {
  date: string;
  tokenPricesByInfoId: Record<string, { closePrice: number }>;
}

interface RawBuySellFiFoRow {
  token_info_id: number;
  unit: string;
  side: string;
  total: number;
  date: string;
  size: number;
}

@Injectable()
export class SummaryService {
  constructor(
    private readonly em: EntityManager,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly tokenInfoService: TokenInfoService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly metricsService: MetricsService,
  ) {}

  // Ported verbatim from dbService.ts's getCoinSummaries - an aggregate/rollup query
  // with no ORM equivalent, so it stays raw SQL. Every numeric column came back as a
  // JS `number` in manual testing against portfolio-db (see story's Dev Notes), so no
  // coercion is applied here.
  async getCoinSummaries(userId: number, unit?: string, onDate?: Date): Promise<CoinSummary[]> {
    const params: unknown[] = [userId];
    let filterClause = '';
    if (unit) {
      filterClause += ' AND trans.unit = ?';
      params.push(unit);
    }
    if (onDate) {
      filterClause += ' AND trans.date <= ?';
      params.push(onDate);
    }

    return (await this.em.getConnection().execute(
      `
      SELECT
        stats.unit AS productName,
        stats.coinName AS coinName,
        COALESCE(latestExchangeRate.rate,0) AS currentPrice,
        COALESCE(stats.buy_count,0) AS countBuys,
        COALESCE(stats.sell_count,0) AS countSells,
        COALESCE(stats.total_buy_quantity,0) AS totalBuyQuantity,
        COALESCE(stats.total_sell_quantity,0) AS totalSellQuantity,
        COALESCE(-1 * stats.total_buy_cost,0) AS totalBuyCost,
        COALESCE(stats.total_sell_profits,0) AS totalSellProfits,
        COALESCE(stats.total_buy_quantity - stats.total_sell_quantity,0) AS holdings,
        COALESCE(-1 * (stats.total_buy_cost / stats.total_buy_quantity), 0) AS avgPurchasePrice,
        COALESCE(stats.total_sell_profits / stats.total_sell_quantity,0) AS avgSellPrice,
        COALESCE((latestExchangeRate.rate * (stats.total_buy_quantity - stats.total_sell_quantity)),0) AS valueOfHoldings,
        COALESCE((stats.total_sell_profits - (-1 * stats.total_buy_cost) + (latestExchangeRate.rate * (stats.total_buy_quantity - stats.total_sell_quantity))),0) AS profitLossAtCurrentPrice,
        COALESCE((-1 * ((stats.total_sell_profits - (-1 * stats.total_buy_cost)) / (stats.total_buy_quantity - stats.total_sell_quantity))),0) AS breakEvenPrice,
        COALESCE(((stats.total_sell_profits - (-1 * stats.total_buy_cost) + (latestExchangeRate.rate * (stats.total_buy_quantity - stats.total_sell_quantity))) / (-1 * stats.total_buy_cost)) * 100, 0) AS percentPL
      FROM (
        SELECT
          trans.unit,
          trans.coinName,
          SUM(CASE WHEN trans.side = 'BUY' THEN 1 ELSE 0 END) AS buy_count,
          SUM(CASE WHEN trans.side = 'SELL' THEN 1 ELSE 0 END) AS sell_count,
          SUM(CASE WHEN trans.side = 'BUY' THEN trans.size ELSE 0 END) AS total_buy_quantity,
          SUM(CASE WHEN trans.side = 'SELL' THEN trans.size ELSE 0 END) AS total_sell_quantity,
          SUM(CASE WHEN trans.side = 'BUY' THEN trans.total ELSE 0 END) AS total_buy_cost,
          SUM(CASE WHEN trans.side = 'SELL' THEN trans.total ELSE 0 END) AS total_sell_profits
        FROM PORTFOLIO.Transaction AS trans
        WHERE trans.userId = ?${filterClause}
        GROUP BY trans.unit, trans.coinName
      ) AS stats
      JOIN (
        SELECT unit, rate
        FROM PORTFOLIO.ExchangeRate
        WHERE date = (SELECT MAX(date) FROM PORTFOLIO.ExchangeRate)
      ) AS latestExchangeRate
      ON stats.unit = latestExchangeRate.unit
      ORDER BY valueOfHoldings DESC
      `,
      params,
    )) as CoinSummary[];
  }

  // Ported verbatim from dbService.ts's getPortfolioSummary - another aggregate/rollup
  // query with no ORM equivalent.
  async getPortfolioSummary(userId: number): Promise<PortfolioSummary> {
    const rows = (await this.em.getConnection().execute(
      `
      SELECT
        SUM(COALESCE(units.costBasis, 0)) AS costBasis,
        SUM(COALESCE(units.total_buy_cost, 0)) AS totalBuyCost,
        SUM(COALESCE(units.total_sell_profits, 0)) AS totalSellProfits,
        SUM(COALESCE((units.rate * units.holdings), 0)) AS valueOfHoldings,
        SUM(COALESCE(((units.rate * units.holdings) - units.costBasis), 0)) AS profitLoss
      FROM (
        SELECT
          _units.*,
          latestExchangeRate.rate AS rate,
          _units.total_buy_cost - _units.total_sell_profits AS costBasis,
          _units.total_buy_quantity - _units.total_sell_quantity AS holdings
        FROM (
          SELECT
            trans.unit,
            SUM(CASE WHEN trans.side = 'BUY' THEN abs(trans.size) ELSE 0 END) AS total_buy_quantity,
            SUM(CASE WHEN trans.side = 'SELL' THEN abs(trans.size) ELSE 0 END) AS total_sell_quantity,
            SUM(CASE WHEN trans.side = 'BUY' THEN abs(trans.total) ELSE 0 END) AS total_buy_cost,
            SUM(CASE WHEN trans.side = 'SELL' THEN abs(trans.total) ELSE 0 END) AS total_sell_profits
          FROM PORTFOLIO.Transaction AS trans
          WHERE trans.userId = ?
          GROUP BY unit
        ) AS _units
        JOIN (
          SELECT unit, rate
          FROM PORTFOLIO.ExchangeRate
          WHERE date = (SELECT MAX(date) FROM PORTFOLIO.ExchangeRate)
        ) AS latestExchangeRate
        ON _units.unit = latestExchangeRate.unit
      ) AS units
      `,
      [userId],
    )) as PortfolioSummary[];

    return rows[0];
  }

  // Ports dbService.ts:139-147's raw SELECT exactly, including the ABS() wrapping.
  // `total`/`size` are FLOAT columns; MikroORM's raw query path renders them through
  // MySQL's text protocol, which truncates FLOAT (not DOUBLE) values to 6 significant
  // digits. ABS() promotes the result to DOUBLE, which round-trips at full precision -
  // reading them through `em.find`'s entity hydration instead reintroduces that
  // truncation for any value with more than 6 significant digits.
  async getBuySellTotalFiFo(userId: number, unit?: string): Promise<BuySellFiFoRow[]> {
    const params: unknown[] = [userId];
    let filterClause = '';
    if (unit) {
      filterClause = ' AND unit = ?';
      params.push(unit);
    }

    const rows = (await this.em.getConnection().execute(
      `
      SELECT token_info_id, unit, side, ABS(total) AS total, date, ABS(size) AS size
      FROM PORTFOLIO.Transaction
      WHERE userId = ?${filterClause}
      ORDER BY date ASC
      `,
      params,
    )) as RawBuySellFiFoRow[];

    return rows.map((row) => ({
      token_info_id: String(row.token_info_id),
      unit: row.unit,
      side: row.side as 'BUY' | 'SELL',
      total: row.total,
      date: new Date(row.date),
      size: row.size,
    }));
  }

  // Ports the FIFO-style walk shared by summary/coins/route.ts:11-31 and
  // summary/portfolio/route.ts:7-24: a SELL adds to netCashHoldings; a BUY draws it
  // down, or once exhausted, adds the shortfall to netContributions and zeroes it.
  private async getNetCashFlowAndContributions(userId: number, unit?: string): Promise<UnitNetMap> {
    const transactions = await this.getBuySellTotalFiFo(userId, unit);
    const unitNetMap: UnitNetMap = {};

    for (const transaction of transactions) {
      if (!unitNetMap[transaction.unit]) {
        unitNetMap[transaction.unit] = { netCashHoldings: 0, netContributions: 0 };
      }
      const { netCashHoldings, netContributions } = unitNetMap[transaction.unit];

      if (transaction.side === 'SELL') {
        unitNetMap[transaction.unit].netCashHoldings = netCashHoldings + transaction.total;
        continue;
      }
      if (netCashHoldings < transaction.total) {
        unitNetMap[transaction.unit].netContributions =
          netContributions + transaction.total - netCashHoldings;
        unitNetMap[transaction.unit].netCashHoldings = 0;
        continue;
      }
      unitNetMap[transaction.unit].netCashHoldings = netCashHoldings - transaction.total;
    }

    return unitNetMap;
  }

  private async getNetCashFlowAndContributionsTotal(
    userId: number,
  ): Promise<{ netCashHoldings: number; netContributions: number }> {
    const transactions = await this.getBuySellTotalFiFo(userId);
    let netCashHoldings = 0;
    let netContributions = 0;

    for (const transaction of transactions) {
      if (transaction.side === 'SELL') {
        netCashHoldings += transaction.total;
        continue;
      }
      if (netCashHoldings < transaction.total) {
        netContributions += transaction.total - netCashHoldings;
        netCashHoldings = 0;
        continue;
      }
      netCashHoldings -= transaction.total;
    }

    return { netCashHoldings, netContributions };
  }

  // Shared by getCoins and getCoinsByUnit - the two routes' mapping bodies are
  // byte-identical in the legacy app aside from the unit filter applied upstream.
  private mapCoinSummaries(
    unitSummaries: CoinSummary[],
    unitNetMap: UnitNetMap,
  ): CoinSummaryResponseDto[] {
    return unitSummaries.map((unitSummary) => ({
      productName: unitSummary.productName,
      coinName: unitSummary.coinName,
      avgPurchasePrice: unitSummary.avgPurchasePrice,
      avgSellPrice: unitSummary.avgSellPrice,
      holdings: unitSummary.holdings,
      valueOfHoldings: unitSummary.valueOfHoldings,
      profitLossAtCurrentPrice: unitSummary.profitLossAtCurrentPrice,
      percentPL: unitSummary.percentPL,
      currentPrice: unitSummary.currentPrice,
      breakEvenPrice: unitSummary.breakEvenPrice,
      inGreen: unitSummary.profitLossAtCurrentPrice > 0,
      totalBuyCost: unitSummary.totalBuyCost,
      totalSellProfits: unitSummary.totalSellProfits,
      costBasis: unitSummary.totalBuyCost - unitSummary.totalSellProfits,
      netContributions: unitNetMap[unitSummary.productName]?.netContributions ?? 0,
      netCashHoldings: unitNetMap[unitSummary.productName]?.netCashHoldings ?? 0,
    }));
  }

  async getCoins(userId: number): Promise<CoinSummaryResponseDto[]> {
    await this.exchangeRatesService.refreshRates();

    const [unitSummaries, unitNetMap] = await Promise.all([
      this.getCoinSummaries(userId),
      this.getNetCashFlowAndContributions(userId),
    ]);

    return this.mapCoinSummaries(unitSummaries, unitNetMap);
  }

  async getCoinsByUnit(userId: number, unit: string): Promise<CoinSummaryResponseDto[]> {
    await this.exchangeRatesService.refreshRates();

    const [unitSummaries, unitNetMap] = await Promise.all([
      this.getCoinSummaries(userId, unit),
      this.getNetCashFlowAndContributions(userId, unit),
    ]);

    return this.mapCoinSummaries(unitSummaries, unitNetMap);
  }

  async getPortfolio(userId: number): Promise<PortfolioSummaryResponseDto> {
    await this.exchangeRatesService.refreshRates();

    const [summary, { netCashHoldings, netContributions }] = await Promise.all([
      this.getPortfolioSummary(userId),
      this.getNetCashFlowAndContributionsTotal(userId),
    ]);

    const accountValue = summary.valueOfHoldings + netCashHoldings;
    const realizedReturn = netCashHoldings - netContributions;
    const roi = (summary.profitLoss / netContributions) * 100;

    return {
      purchases: summary.totalBuyCost,
      sales: summary.totalSellProfits,
      costBasis: summary.costBasis,
      valueOfHoldings: summary.valueOfHoldings,
      totalPLatCurrentPrice: summary.profitLoss,
      netCashHoldings,
      netContributions,
      accountValue,
      realizedReturn,
      roi,
      inGreen: summary.profitLoss > 0,
    };
  }

  // Ported from update-price-history.ts's getPriceHistoryMap. Buckets each held
  // coin's price history by date, folding same-date points from different coins into
  // one row keyed by token_info_id.
  //
  // Destructures index 1 (openPrice), not index 2 (closePrice), of the
  // [unixTimestamp, openPrice, closePrice] tuple - the source function's bug,
  // reproduced here for output parity rather than silently fixed.
  private async getPriceHistoryMap(
    userId: number,
    timeFrame: string,
    firstTxDate?: dayjs.Dayjs,
  ): Promise<TokenPriceDate[]> {
    if (!firstTxDate) {
      return [];
    }

    const tokens = await this.tokenInfoService.getTokensForUserId(userId);
    const tokenPriceDates: TokenPriceDate[] = [];

    await Promise.all(
      tokens.map(async (token) => {
        const tokenPriceHistory = await this.exchangeRatesService.getPriceHistoryForTimeFrame(
          token.coinName,
          timeFrame,
        );

        tokenPriceHistory.prices.forEach(([unixTimestamp, closePrice]) => {
          const date = dayjs.unix(unixTimestamp).utc().format('YYYY-MM-DD HH:mm:ss');
          const dateEntry = tokenPriceDates.find((entry) => entry.date === date);
          if (!dateEntry) {
            tokenPriceDates.push({
              date,
              tokenPricesByInfoId: { [token.tokenInfoId]: { closePrice } },
            });
          } else {
            dateEntry.tokenPricesByInfoId[token.tokenInfoId] = { closePrice };
          }
        });
      }),
    );

    return tokenPriceDates.sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
  }

  // Ported from update-price-history.ts's getNetCashFlowHistory: a FIFO walk over
  // getBuySellTotalFiFo joined against per-date price points, tracking running
  // holdings/cost-basis per coin to derive each date's value-of-holdings and P/L.
  // Returns undefined when the user has no transactions - the caller substitutes the
  // empty-chart fallback.
  private async getNetCashFlowHistory(
    userId: number,
    timeFrame: string,
  ): Promise<ProfitLossChartResponseDto | undefined> {
    const transactions = await this.getBuySellTotalFiFo(userId);
    const firstTxDate = transactions.length
      ? dayjs(transactions[0].date).subtract(1, 'day').utc()
      : undefined;
    const tokenPriceDates = await this.getPriceHistoryMap(userId, timeFrame, firstTxDate);

    if (!transactions.length) {
      return undefined;
    }

    let netCash = 0;
    let netContributions = 0;
    const tokenData: Record<string, { holdings: number; costBasis: number }> = {};
    const netRows: ProfitLossChartResponseDto['netRows'] = [];

    let lowestPointIndex = 0;
    let highestPointIndex = 0;
    let index = 0;

    for (const { date, tokenPricesByInfoId } of tokenPriceDates) {
      const rowDate = dayjs(date);
      if (rowDate.isBefore(firstTxDate)) {
        continue;
      }

      while (
        index < transactions.length &&
        dayjs(transactions[index].date).isSameOrBefore(rowDate)
      ) {
        const tx = transactions[index];
        index += 1;

        if (!tokenData[tx.token_info_id]) {
          tokenData[tx.token_info_id] = { holdings: 0, costBasis: 0 };
        }

        if (tx.side === 'SELL') {
          netCash += tx.total;
          tokenData[tx.token_info_id].holdings -= tx.size;
          tokenData[tx.token_info_id].costBasis -= tx.total;
        }
        if (tx.side === 'BUY') {
          tokenData[tx.token_info_id].holdings += tx.size;
          tokenData[tx.token_info_id].costBasis += tx.total;
          if (netCash < tx.total) {
            netContributions += tx.total - netCash;
            netCash = 0;
          } else {
            netCash -= tx.total;
          }
        }
      }

      let valueOfHoldings = 0;
      let profitLoss = 0;

      for (const [tokenInfoId, { holdings, costBasis }] of Object.entries(tokenData)) {
        const price = tokenPricesByInfoId[tokenInfoId]?.closePrice ?? 0;
        valueOfHoldings += holdings * price;
        profitLoss += holdings * price - costBasis;
      }

      const roi = netContributions !== 0 ? (profitLoss / netContributions) * 100 : 0;

      if (netRows.length && profitLoss < netRows[lowestPointIndex].profitLoss) {
        lowestPointIndex = netRows.length;
      }
      if (netRows.length && profitLoss > netRows[highestPointIndex].profitLoss) {
        highestPointIndex = netRows.length;
      }

      netRows.push({ date: new Date(date).getTime(), valueOfHoldings, profitLoss, roi });
    }

    return { netRows, lowestPointIndex, highestPointIndex };
  }

  // Wraps getNetCashFlowHistory with the Redis cache both profitLossChart routes
  // share (query-param and path-param variants call this identically).
  async getProfitLossChart(userId: number, timeFrame: string): Promise<ProfitLossChartResponseDto> {
    const cacheKey = `net-cash-flow-history-${userId}-${timeFrame}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.metricsService.redisCacheResultsCounter.inc({
        cache_key_prefix: 'net_cash_flow_history',
        result: 'hit',
      });
      return JSON.parse(cached) as ProfitLossChartResponseDto;
    }
    this.metricsService.redisCacheResultsCounter.inc({
      cache_key_prefix: 'net_cash_flow_history',
      result: 'miss',
    });

    const data = (await this.getNetCashFlowHistory(userId, timeFrame)) ?? {
      netRows: [],
      lowestPointIndex: 0,
      highestPointIndex: 0,
    };
    await this.redis.setex(cacheKey, NET_CASH_FLOW_HISTORY_CACHE_TTL, JSON.stringify(data));

    return data;
  }
}
