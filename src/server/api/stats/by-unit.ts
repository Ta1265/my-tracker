import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../db/db';
import { getExchangeRates } from '../../helpers/get-exchange-rates';
import { formatUSD } from '../../helpers/format-usd';
import { getServerAuthSession } from '../../auth';

const formatStats = (stats: any[]) =>
  stats.map((stat) => ({
    productName: stat.productName,
    // countBuys: stat.countBuys,
    // countSells: stat.countSells,
    // totalBuyQuantity: stat.totalBuyQuantity.toFixed(4),
    // totalSellQuantity: stat.totalSellQuantity.toFixed(4),
    // totalBuyCost: formatUSD(stat.totalBuyCost),
    // totalSellProfits: formatUSD(stat.totalSellProfits),
    avgPurchasePrice: formatUSD(stat.avgPurchasePrice),
    avgSellPrice: formatUSD(stat.avgSellPrice),
    // 'Profit/Loss': formatUSD(stat.profitLoss),
    holdings: stat.holdings.toFixed(4),
    valueOfHoldings: formatUSD(stat.valueOfHoldings),
    profitLossAtCurrentPrice: formatUSD(stat.profitLossAtCurrentPrice),
    percentPL: stat.percentPL.toFixed(1) + '%',
    currentPrice: formatUSD(stat.currentPrice),
    breakEvenPrice: formatUSD(stat.breakEvenPrice),
  }));

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  const session = await getServerAuthSession({ req, res });
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  await getExchangeRates();

  const queryStats = await db.$queryRaw<any>`
    SELECT
      stats.unit AS productName,
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
        SUM(CASE WHEN side = 'BUY' THEN 1 ELSE 0 END) as buy_count,
        SUM(CASE WHEN side = 'SELL' THEN 1 ELSE 0 END) as sell_count,
        SUM(CASE WHEN trans.side = 'BUY' THEN trans.size ELSE 0 END) AS total_buy_quantity,
        SUM(CASE WHEN trans.side = 'SELL' THEN trans.size ELSE 0 END) AS total_sell_quantity,
        SUM(CASE WHEN trans.side = 'BUY' THEN trans.total ELSE 0 END) AS total_buy_cost,
        SUM(CASE WHEN trans.side = 'SELL' THEN trans.total ELSE 0 END) AS total_sell_profits
      FROM
        PORTFOLIO.Transaction as trans
      WHERE trans.unit = ${req.query.unit} AND trans.userId = ${userId}
      GROUP BY unit
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
		WHERE stats.unit = ${req.query.unit};
  `;

  res.status(200).json(formatStats(queryStats)[0]);
}
