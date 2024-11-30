import { db } from './db';
import { Prisma } from '@prisma/client'

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

async function getCoinSummaries(userId: number, unit?: string): Promise<CoinSummary[]> {
  return db.$queryRaw<any>`
    SELECT
      stats.unit AS productName,
      stats.coinName AS coinName,
      COALESCE(stats.latestExchangeRate.rate,0) AS currentPrice,
      COALESCE(stats.buy_count,0) AS countBuys,
      COALESCE(stats.sell_count,0) AS countSells,
      COALESCE(stats.total_buy_quantity,0) AS totalBuyQuantity,
      COALESCE(stats.total_sell_quantity,0) AS totalSellQuantity,
      COALESCE(-1 * stats.total_buy_cost,0) AS totalBuyCost,
      COALESCE(stats.total_sell_profits,0) AS totalSellProfits,
      COALESCE(stats.total_buy_quantity - stats.total_sell_quantity,0) AS holdings,
      COALESCE(-1* (stats.total_buy_cost / stats.total_buy_quantity), 0) AS avgPurchasePrice,
      COALESCE(stats.total_sell_profits / stats.total_sell_quantity,0) AS avgSellPrice,
      COALESCE((stats.latestExchangeRate.rate * (stats.total_buy_quantity - stats.total_sell_quantity)),0) AS valueOfHoldings,
      COALESCE((stats.total_sell_profits - (-1 * stats.total_buy_cost) + (stats.latestExchangeRate.rate * (stats.total_buy_quantity - stats.total_sell_quantity))),0) AS profitLossAtCurrentPrice,
      COALESCE((-1 * ((stats.total_sell_profits - (-1 * stats.total_buy_cost)) / (stats.total_buy_quantity - stats.total_sell_quantity))),0) AS breakEvenPrice,
      COALESCE(((stats.total_sell_profits - (-1 * stats.total_buy_cost) + (stats.latestExchangeRate.rate * (stats.total_buy_quantity - stats.total_sell_quantity))) / (-1 * stats.total_buy_cost)) * 100, 0) AS percentPL
    FROM (
      SELECT
        trans.unit,
        trans.coinName,
        SUM(CASE WHEN side = 'BUY' THEN 1 ELSE 0 END) as buy_count,
        SUM(CASE WHEN side = 'SELL' THEN 1 ELSE 0 END) as sell_count,
        SUM(CASE WHEN trans.side = 'BUY' THEN trans.size ELSE 0 END) AS total_buy_quantity,
        SUM(CASE WHEN trans.side = 'SELL' THEN trans.size ELSE 0 END) AS total_sell_quantity,
        SUM(CASE WHEN trans.side = 'BUY' THEN trans.total ELSE 0 END) AS total_buy_cost,
        SUM(CASE WHEN trans.side = 'SELL' THEN trans.total ELSE 0 END) AS total_sell_profits
      FROM
        PORTFOLIO.Transaction as trans
      WHERE
        trans.userId = ${userId}
        ${unit ? Prisma.sql`AND trans.unit = ${unit}` : Prisma.empty}
      GROUP BY unit, coinName
    ) as stats
      JOIN (
        SELECT unit, rate
        FROM PORTFOLIO.ExchangeRate
        WHERE date = (
          SELECT MAX(date)
          FROM PORTFOLIO.ExchangeRate
        )
      ) as latestExchangeRate
      ON stats.unit = latestExchangeRate.unit
      ORDER BY valueOfHoldings DESC;
  `;
}

interface PortfolioSummary {
  costBasis: number;
  totalBuyCost: number;
  totalSellProfits: number;
  valueOfHoldings: number;
  profitLoss: number;
}

async function getPortfolioSummary(userId: number) {
  const transactionSummary = await db.$queryRaw<PortfolioSummary[]>`
    SELECT
      -- Aggregate unit totals into overall portfolio summary
      SUM(COALESCE(units.costBasis, 0)) AS costBasis,
      SUM(COALESCE(units.total_buy_cost, 0)) AS totalBuyCost,
      SUM(COALESCE(units.total_sell_profits, 0)) AS totalSellProfits,
      SUM(COALESCE((units.rate * units.holdings), 0)) AS valueOfHoldings,
      SUM(COALESCE(((units.rate * units.holdings) - units.costBasis), 0)) AS profitLoss
    FROM (
      SELECT
				-- additional subquery to store costBasis and holdings in intermediate values
        _units.*,
        latestExchangeRate.rate as rate,
        _units.total_buy_cost - _units.total_sell_profits as costBasis,
        _units.total_buy_quantity - _units.total_sell_quantity as holdings
      FROM (
        -- Aggregate by unit, join with latest exchange rate
        SELECT
          trans.unit,
          SUM(CASE WHEN trans.side = 'BUY' THEN abs(trans.size) ELSE 0 END) AS total_buy_quantity,
          SUM(CASE WHEN trans.side = 'SELL' THEN abs(trans.size) ELSE 0 END) AS total_sell_quantity,
          SUM(CASE WHEN trans.side = 'BUY' THEN abs(trans.total) ELSE 0 END) AS total_buy_cost,
          SUM(CASE WHEN trans.side = 'SELL' THEN abs(trans.total) ELSE 0 END) AS total_sell_profits
        FROM
          PORTFOLIO.Transaction as trans
        WHERE
          trans.userId = 1
        GROUP BY unit 
      ) as _units
        JOIN (
          SELECT unit, rate
          FROM PORTFOLIO.ExchangeRate
          WHERE date = (
            SELECT MAX(date)
            FROM PORTFOLIO.ExchangeRate
          )
        ) as latestExchangeRate
        ON _units.unit = latestExchangeRate.unit
    ) as units;
  `;

  return transactionSummary[0];
}


async function getBuySellTotalFiFo(userId: number) {
  return db.$queryRaw<[{ side: 'BUY' | 'SELL'; total: number }]>`
    SELECT side, ABS(total) as total
    FROM PORTFOLIO.Transaction 
    WHERE userId = ${userId}
    ORDER BY date ASC
  `;
}

const dbService = {
  getCoinSummaries,
  getPortfolioSummary,
  getBuySellTotalFiFo,
}

export default dbService;