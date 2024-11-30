import type { NextApiRequest, NextApiResponse } from 'next';
import { getExchangeRates } from '../../helpers/get-exchange-rates';
import { formatUSD } from '../../helpers/format-usd';
import { getServerAuthSession } from '../../auth';
import DBService from '../../db/dbService';
import type { CoinSummaryResp } from '../../../../types/global';

const formatSummaries = (
  stats: Awaited<ReturnType<typeof DBService.getCoinSummaries>>,
): CoinSummaryResp[] =>
  stats.map((stat) => ({
    productName: stat.productName,
    coinName: stat.coinName,
    avgPurchasePrice: formatUSD(stat.avgPurchasePrice),
    avgSellPrice: formatUSD(stat.avgSellPrice),
    holdings: stat.holdings.toFixed(4),
    valueOfHoldings: formatUSD(stat.valueOfHoldings),
    profitLossAtCurrentPrice: formatUSD(stat.profitLossAtCurrentPrice),
    percentPL: stat.percentPL.toFixed(1) + '%',
    currentPrice: formatUSD(stat.currentPrice),
    breakEvenPrice: formatUSD(stat.breakEvenPrice),
    inGreen: stat.profitLossAtCurrentPrice > 0,
  }));

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CoinSummaryResp[] | { error: string }>,
) {
  const session = await getServerAuthSession({ req, res });
  const userId = session?.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let unit = req.query?.unit as string | undefined;

  // fetch and store to the db the latest exchange rates from coinbase
  await getExchangeRates();
  const unitSummaries = await DBService.getCoinSummaries(userId, unit);

  const formatted = formatSummaries(unitSummaries);

  return res.status(200).json(formatted);
}
