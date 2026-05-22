import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRates } from '@/server/helpers/get-exchange-rates';
import { getServerAuthSession } from '@/server/auth';
import DBService from '@/server/db/dbService';
import type { PortfolioSummary } from '../../../../../types/global';

async function getNetCashFlowAndContributions(userId: number) {
  const transactions = await DBService.getBuySellTotalFiFo(userId);
  let netCashHoldings = 0;
  let netContributions = 0;
  transactions.forEach((transaction) => {
    if (transaction.side === 'SELL') {
      netCashHoldings += transaction.total;
      return;
    }
    if (netCashHoldings < transaction.total) {
      netContributions += transaction.total - netCashHoldings;
      netCashHoldings = 0;
      return;
    }
    netCashHoldings -= transaction.total;
  });
  return { netCashHoldings, netContributions };
}

async function getTotalSummary(userId: number): Promise<PortfolioSummary> {
  const [summary, { netCashHoldings, netContributions }] = await Promise.all([
    DBService.getPortfolioSummary(userId),
    getNetCashFlowAndContributions(userId),
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

export async function GET(_req: NextRequest) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await getExchangeRates();
  const summary = await getTotalSummary(userId);
  return NextResponse.json(summary);
}
