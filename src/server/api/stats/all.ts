
import type { NextApiRequest, NextApiResponse } from 'next';
import { getExchangeRates } from '../../helpers/get-exchange-rates';
import { formatUSD } from '../../helpers/format-usd';
import { getServerAuthSession } from '../../auth';
import DBService from '../../db/dbService';

async function getUnitSummaries(userId: number) {
  const unitSummaries = await DBService.getCoinSummaries(userId);

  return unitSummaries.map((stat) => ({
    productName: stat.productName,
    coinName: stat.coinName,
    avgPurchasePrice: formatUSD(stat.avgPurchasePrice),
    holdings: stat.holdings.toFixed(4),
    valueOfHoldings: formatUSD(stat.valueOfHoldings),
    profitLossAtCurrentPrice: formatUSD(stat.profitLossAtCurrentPrice),
    percentPL: stat.percentPL.toFixed(1) + '%',
    currentPrice: formatUSD(stat.currentPrice),
    breakEvenPrice: formatUSD(stat.breakEvenPrice),
    chicken: stat,
  }));
}

async function getNetCashFlowAndContributions(userId: number) {
  // Calculate net cash holdings and total contributions assuming reinvested gains (FIFO by date)
  const transactions = await DBService.getBuySellTotalFiFo(userId);

  let netCashHoldings = 0; // Tracks remaining cash from sell transactions
  let netContributions = 0; // Tracks total personal funds contributed

  transactions.forEach((transaction) => {
    if (transaction.side === 'SELL') {
      netCashHoldings += transaction.total;
      return;
    }
    // side === 'BUY'
    if (netCashHoldings < transaction.total) {
      // deposit the difference
      netContributions += transaction.total - netCashHoldings;
      netCashHoldings = 0;
      return;
    }
    // pay for purchase with previous sales
    netCashHoldings -= transaction.total;
  });

  return { netCashHoldings, netContributions };
}


async function getTotalSummary(userId: number) {
  const [summary, { netCashHoldings, netContributions }] = await Promise.all([
    DBService.getPortfolioSummary(userId),
    getNetCashFlowAndContributions(userId),
  ]);

  const accountValue = summary.valueOfHoldings + netCashHoldings;

  const realizedReturn = netCashHoldings - netContributions;

  // 2. Net Return on Invested Capital (Net Gain as a Percentage of All Money Put In)
  // This measures your return as a percentage of the total money that was ever part of your portfolio.
  const roi = (summary.profitLoss / netContributions) * 100;

  return {
    purchases: formatUSD(summary.totalBuyCost, true),
    sales: formatUSD(summary.totalSellProfits, true),
    costBasis: formatUSD(summary.costBasis, true),
    valueOfHoldings: formatUSD(summary.valueOfHoldings, true),
    totalPLatCurrentPrice: formatUSD(summary.profitLoss, true),
    netCashHoldings: formatUSD(netCashHoldings, true),
    netContributions: formatUSD(netContributions, true),
    accountValue: formatUSD(accountValue, true),
    realizedReturn: formatUSD(realizedReturn, true),
    roi: roi.toFixed(2) + '%',
    inGreen: summary.profitLoss > 0,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  const session = await getServerAuthSession({ req, res });
  const userId = session?.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // fetch and store to the db the latest exchange rates from coinbase
  await getExchangeRates();

  const [unitSummaries, totalSummary] = await Promise.all([
    getUnitSummaries(userId),
    getTotalSummary(userId),
  ]);

  res.status(200).json({
    stats: unitSummaries,
    summary: totalSummary,
  });
}
