import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/server/auth';
import { getExchangeRates, getPriceHistoryForTimeFrame } from '@/server/helpers/get-exchange-rates';
import DBService from '@/server/db/dbService';
import { type TimeFrame } from '../../../../../types/global';

export async function GET(_req: NextRequest, { params }: { params: { timeFrame: string } }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id as number;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const timeFrame = params.timeFrame as TimeFrame;

  await getExchangeRates();
  const coinSummaries = await DBService.getCoinSummaries(userId);

  let pastTotalValue = 0;
  let currentTotalValue = 0;
  let totalPastPl = 0;
  let totalCurPl = 0;

  await Promise.all(
    coinSummaries.map(async (coinSummary) => {
      const priceHistory = await getPriceHistoryForTimeFrame(coinSummary.coinName, timeFrame);
      const startPrice = priceHistory.prices[0][1];
      const curPrice = coinSummary.currentPrice;
      const costBasis = Math.abs(coinSummary.totalBuyCost) - Math.abs(coinSummary.totalSellProfits);
      const holdings = coinSummary.holdings;
      pastTotalValue += startPrice * holdings;
      currentTotalValue += curPrice * holdings;
      totalPastPl += startPrice * holdings - costBasis;
      totalCurPl += curPrice * holdings - costBasis;
    }),
  );

  return NextResponse.json({ pastTotalValue, currentTotalValue, totalPastPl, totalCurPl });
}
