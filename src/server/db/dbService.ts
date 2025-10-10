import { Decimal } from 'decimal.js';
import { db } from './db';
import { Prisma } from '@prisma/client'
import moment from 'moment';
import { type TimeFrame } from '../../../types/global';

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

async function getCoinSummaries(userId: number, unit?: string, onDate?: Date): Promise<CoinSummary[]> {
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
        ${onDate? Prisma.sql`AND trans.date <= ${onDate}` : Prisma.empty}
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
          trans.userId = ${userId}
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


async function getBuySellTotalFiFo(userId: number, unit?: string) {
  return db.$queryRaw<[{ token_info_id: string, unit: string, side: 'BUY' | 'SELL'; total: number, date: Date, size: number }]>`
    SELECT token_info_id, unit, side, ABS(total) as total, date, ABS(size) as size
    FROM PORTFOLIO.Transaction 
    WHERE userId = ${userId}
    ${unit ? Prisma.sql`AND unit = ${unit}` : Prisma.empty}
    ORDER BY date ASC
  `;
}

async function getBuySellTotalFifoToDate(userId: number, toDate: Date, unit?: string) {
  return db.$queryRaw<[{ unit: string, side: 'BUY' | 'SELL'; total: number }]>`
    SELECT unit, side, ABS(total) as total
    FROM PORTFOLIO.Transaction 
    WHERE userId = ${userId}
      AND date <= ${toDate}
      ${unit ? Prisma.sql`AND unit = ${unit}` : Prisma.empty}
    ORDER BY date ASC
  `;
}

async function getTransactionsForUserOrdered(userId: number) {
  const transactions = await db.$queryRaw<[{ unit: string, side: 'BUY' | 'SELL'; total: number, unix_ts: number }]>`
    SELECT 
      unit, 
      side, 
      ABS(total) as total
      UNIX_TIMESTAMP(date) as unix_ts
    FROM PORTFOLIO.Transaction
    WHERE userId = ${userId}
    ORDER BY date ASC
  `;

  return transactions.map((tx) => ({
    ...tx,
    total: Decimal(tx.total)
  }));
}

async function getTimeFramePriceChange(
  userId: number,
  timeFrameStartPrices: [unit: string, startPrice: number][],
) {
  return db.$queryRaw<any>`
    SELECT 
      units.unit as unit,
      (units.startPrice * units.holdings) - units.costBasis AS pastProfitLoss,
      (units.currentPrice * units.holdings) - units.costBasis as currentProfitLoss,
      units.startPrice as timeFrameStartPrice
    FROM (
        
        SELECT
          -- additional subquery to store costBasis and holdings in intermediate values
          _units.unit,
          timeFrame.startPrice as startPrice,
          latestExchangeRate.rate as currentPrice,
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
            trans.userId = ${userId}
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
        
        LEFT JOIN (
          ${timeFrameStartPrices.map(([unit, startPrice]) => Prisma.sql`SELECT ${unit} as unit, ${startPrice} as startPrice`)
          .reduce((acc, curr) => Prisma.sql`${acc} UNION ALL ${curr}`)}
          SELECT 'BTC' as unit, 100000 as startPrice
          UNION ALL
          SELECT 'ETH' as unit, 102 as startPrice
          UNION ALL
          SELECT 'ADA' as unit, 2 as startPrice
        ) AS timeFrame
        ON _units.unit = timeFrame.unit
        
        WHERE _units.unit IN ('BTC', 'ETH', 'ADA')
    ) as units;
  `;
}

async function getNetCashFlowHistory(userId: number, timeFrame: TimeFrame): Promise<
  {
    date: Date;
    netCash: number;
    netContributions: number;
    valueOfHoldings: number;
    profitLoss: number;
    roi: number;
    ror: number;
    totalCostBasis: number;
  }[]
> {
  
  let greaterThanDate = 'all';
  let time = null;
  if (timeFrame === 'all') {
    greaterThanDate = '2015-01-01 00:00:00';
  } else if (timeFrame === 'h') {
    greaterThanDate = moment().subtract(1, 'hour').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === 'd') {
    greaterThanDate = moment().subtract(1, 'day').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === 'w') {
    greaterThanDate = moment().subtract(7, 'days').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === 'm') {
    greaterThanDate = moment().subtract(1, 'month').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === '3m') {
    greaterThanDate = moment().subtract(3, 'months').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === '6m') {
    greaterThanDate = moment().subtract(6, 'months').utc().format('YYYY-MM-DD HH:mm:ss');
    time = '00:00:00';
  } else if (timeFrame === 'y') {
    greaterThanDate = moment().subtract(1, 'year').utc().format('YYYY-MM-DD HH:mm:ss');
    time = '00:00:00';
  } 

  return db.$queryRaw`
      SELECT 
        userId,
        date,
        netCash,
        netContributions,
        valueOfHoldings,
        profitLoss,
        totalCostBasis,
        roi,
        ror
      FROM NetCashFlow 
      WHERE userId = ${userId}
        AND date >= ${greaterThanDate}
        ${time ? Prisma.sql`AND TIME(date) = ${time}` : Prisma.empty}
      ORDER BY date ASC;
  `;
}

const getTokensForUserId = async (userId: number): Promise<{ coinName: string; unit: string; TokenInfoId: number }[]> => {
  return db.$queryRaw`
    SELECT DISTINCT
      trans.coinName as coinName
      ,trans.unit as unit
      ,tokenInfo.token_id as TokenInfoId
    FROM Transaction AS trans
    JOIN TokenInfo AS tokenInfo
      ON trans.unit = tokenInfo.symbol
    WHERE trans.userId = ${userId}
  `;
}

const insertIntoTokenPriceHistory = async (rows: { timeFrame: TimeFrame; closePrice: string; timeStamp: string; tokenInfoId: number; }[]) => {
  if (rows.length === 0) {
    console.log('No rows to insert into TokenPriceHistory.');
    return;
  }
  const values = rows
    .map(
      ({ timeFrame, closePrice, timeStamp, tokenInfoId }) =>
        `('${timeFrame}', '${closePrice}', '${timeStamp}', '${tokenInfoId}')`,
    )
    .join(', ');

  const sql = `INSERT IGNORE INTO TokenPriceHistory (timeFrame, close_price, date, token_info_id) VALUES ${values};`;
  
  const result = await db.$executeRawUnsafe(sql);

  console.log(`Inserted ${result} rows into TokenPriceHistory.`);
}

const insertIntoNetCashFlow = async (
  rows: {
    date: string;
    netCash: string;
    netContributions: string;
    userId: number;
    valueOfHoldings: string;
    profitLoss: string;
    roi: string;
    ror: string;
    totalCostBasis: string;
  }[],
) => {
  if (rows.length === 0) {
    console.log('No rows to insert into NetCashFlow.');
    return;
  }
  const values = rows
    .map(
      ({ date, netCash, netContributions, userId, valueOfHoldings, profitLoss, roi, ror, totalCostBasis }) =>
        `('${date}', '${netCash}', '${netContributions}', '${userId}', '${valueOfHoldings}', '${profitLoss}', '${roi}', '${ror}', '${totalCostBasis}')`,
    )
    .join(', ');

  const sql = `
    INSERT INTO NetCashFlow (date, netCash, netContributions, userId, valueOfHoldings, profitLoss, roi, ror, totalCostBasis) 
    VALUES ${values}
    ON DUPLICATE KEY UPDATE 
      netCash = VALUES(netCash),
      netContributions = VALUES(netContributions),
      valueOfHoldings = VALUES(valueOfHoldings),
      profitLoss = VALUES(profitLoss),
      roi = VALUES(roi),
      ror = VALUES(ror),
      totalCostBasis = VALUES(totalCostBasis);`;

  const result = await db.$executeRawUnsafe(sql);

  console.log(`Inserted/Updated ${result} rows into NetCashFlow.`);
};


async function getPriceHistoryMap(
  tokenInfoIds: string[],
  timeFrame: TimeFrame = 'all',
  startDate: string = '2015-01-01 00:00:00',
): Promise<{ date: string; tokenPricesByInfoId: { [token_info_id: string]: { closePrice: number } } }[]> {
// export type TimeFrame = 'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all';
  let greaterThanDate = 'all';
  let time = null;
  if (timeFrame === 'all') {
    greaterThanDate = '2015-01-01 00:00:00';
  } else if (timeFrame === 'h') {
    greaterThanDate = moment().subtract(1, 'hour').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === 'd') {
    greaterThanDate = moment().subtract(1, 'day').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === 'w') {
    greaterThanDate = moment().subtract(7, 'days').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === 'm') {
    greaterThanDate = moment().subtract(1, 'month').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === '3m') {
    greaterThanDate = moment().subtract(3, 'months').utc().format('YYYY-MM-DD HH:mm:ss');
  } else if (timeFrame === '6m') {
    greaterThanDate = moment().subtract(6, 'months').utc().format('YYYY-MM-DD HH:mm:ss');
    time = '00:00:00';
  } else if (timeFrame === 'y') {
    greaterThanDate = moment().subtract(1, 'year').utc().format('YYYY-MM-DD HH:mm:ss');
    time = '00:00:00';
  } 

  const rows = await db.$queryRaw<
    { date: string; tokens: string }[]
  >`
    SELECT 
      date,
      JSON_OBJECTAGG(
        token_info_id, 
        JSON_OBJECT('closePrice', close_price)
      ) as tokens
    FROM TokenPriceHistory
    WHERE 
      token_info_id IN (${Prisma.join(tokenInfoIds)})
      AND date >= ${startDate}
      AND date >= ${greaterThanDate}
      ${time ? Prisma.sql`AND TIME(date) = ${time}` : Prisma.empty}
      AND timeFrame = ${timeFrame}
    GROUP BY date
    ORDER BY date ASC;
  `;

  console.log('rows', rows[0])

  return rows.map(({ date, tokens }) => ({ 
    date: moment(date).format('YYYY-MM-DD HH:mm:ss'),
    tokenPricesByInfoId: tokens || {}
  }));
}


const dbService = {
  getTimeFramePriceChange,
  getTokensForUserId,
  insertIntoTokenPriceHistory,
  insertIntoNetCashFlow,
  getNetCashFlowHistory,
  getPriceHistoryMap,
  getCoinSummaries,
  getPortfolioSummary,
  getBuySellTotalFiFo,
  getTransactionsForUserOrdered
}

export default dbService;