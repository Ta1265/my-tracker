import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/server/auth';
import { getExchangeRates } from '@/server/helpers/get-exchange-rates';
import { formatUSD } from '@/server/helpers/format-usd';
import dbService from '@/server/db/dbService';

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

export async function GET(_req: NextRequest, { params }: { params: { unit: string } }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { unit } = params;

  await getExchangeRates();
  const unitSummary = await dbService.getCoinSummaries(userId, unit);
  const formatted = formatStats(unitSummary);

  return NextResponse.json(formatted[0]);
}
