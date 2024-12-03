import type { NextApiRequest, NextApiResponse } from 'next';
import { getExchangeRates } from '../../helpers/get-exchange-rates';
import { formatUSD } from '../../helpers/format-usd';
import { getServerAuthSession } from '../../auth';
import DBService from '../../db/dbService';
import type { CoinSummaryResp } from '../../../../types/global';

interface UnitNetMap {
  [unit: string]: {
    netCashHoldings: number;
    netContributions: number;
  };
}

const formatSummaries = (
  stats: Awaited<ReturnType<typeof DBService.getCoinSummaries>>,
  unitNetMap: UnitNetMap,
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
    totalBuyCost: stat.totalBuyCost,
    totalSellProfits: stat.totalSellProfits,
    costBasis: stat.totalBuyCost - stat.totalSellProfits,
    netContributions: unitNetMap[stat.productName]?.netContributions || 0,
  }));

async function getNetCashFlowAndContributions(userId: number) {
  // Calculate net cash holdings and total contributions assuming reinvested gains (FIFO by date)
  const transactions = await DBService.getBuySellTotalFiFo(userId);

  const unitNetMap: UnitNetMap = {};

  transactions.forEach((transaction) => {
    if (!unitNetMap[transaction.unit]) {
      unitNetMap[transaction.unit] = { netCashHoldings: 0, netContributions: 0 };
    }

    const { netCashHoldings, netContributions } = unitNetMap[transaction.unit];

    if (transaction.side === 'SELL') {
      unitNetMap[transaction.unit].netCashHoldings = netCashHoldings + transaction.total;
      return;
    }
    // side === 'BUY'
    if (netCashHoldings < transaction.total) {
      // deposit the difference
      unitNetMap[transaction.unit].netContributions = netContributions + transaction.total - netCashHoldings;
      unitNetMap[transaction.unit].netCashHoldings = 0;
      return;
    }
    // pay for purchase with previous sales
    unitNetMap[transaction.unit].netCashHoldings = netCashHoldings - transaction.total;
  });

  return unitNetMap;
}

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
  const unitNetMap = await getNetCashFlowAndContributions(userId, unit);

  const formatted = formatSummaries(unitSummaries, unitNetMap);

  return res.status(200).json(formatted);
}
