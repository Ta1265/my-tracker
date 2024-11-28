import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../db/db';
import { getExchangeRates } from '../../helpers/get-exchange-rates';
import { formatUSD } from '../../helpers/format-usd';
import { getServerAuthSession } from '../../auth';
import dbService from '../../db/dbService';

const formatStats = (stats: any[]) =>
  stats.map((stat) => ({
    productName: stat.productName,
    avgPurchasePrice: formatUSD(stat.avgPurchasePrice),
    avgSellPrice: formatUSD(stat.avgSellPrice),
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
  const unit = req.query.unit as string

  await getExchangeRates();
  const unitSummary = await dbService.getCoinSummaries(userId, unit);
  const formatted = formatStats(unitSummary);

  res.status(200).json(formatted[0]);
}
