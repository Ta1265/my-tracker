import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRates } from '@/server/helpers/get-exchange-rates';
import { getServerAuthSession } from '@/server/auth';
import DBService from '@/server/db/dbService';
import type { CoinSummaryResp } from '../../../../../types/global';

interface UnitNetMap {
  [unit: string]: { netCashHoldings: number; netContributions: number };
}

async function getNetCashFlowAndContributions(userId: number, unit?: string): Promise<UnitNetMap> {
  const transactions = await DBService.getBuySellTotalFiFo(userId, unit);
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
    if (netCashHoldings < transaction.total) {
      unitNetMap[transaction.unit].netContributions = netContributions + transaction.total - netCashHoldings;
      unitNetMap[transaction.unit].netCashHoldings = 0;
      return;
    }
    unitNetMap[transaction.unit].netCashHoldings = netCashHoldings - transaction.total;
  });
  return unitNetMap;
}

export async function GET(_req: NextRequest) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await getExchangeRates();
  const unitSummaries = await DBService.getCoinSummaries(userId);
  const unitNetMap = await getNetCashFlowAndContributions(userId);

  const formatted: CoinSummaryResp[] = unitSummaries.map((unitSummary) => ({
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
    netContributions: unitNetMap[unitSummary.productName]?.netContributions || 0,
    netCashHoldings: unitNetMap[unitSummary.productName]?.netCashHoldings || 0,
  }));

  return NextResponse.json(formatted);
}
