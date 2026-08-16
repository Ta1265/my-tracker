import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/server/auth';
import { getPriceHistoryForTimeFrame } from '@/server/helpers/get-exchange-rates';
import DBService, { type CoinSummary } from '@/server/db/dbService';
import { type TimeFramePlByUnitResp, type TimeFrame } from '../../../../../types/global';

const getTimeFrameStartDate = (timeFrame: TimeFrame): Date => {
  const now = new Date();
  switch (timeFrame) {
    case 'h': now.setHours(now.getHours() - 1); break;
    case 'd': now.setDate(now.getDate() - 1); break;
    case 'w': now.setDate(now.getDate() - 7); break;
    case 'm': now.setMonth(now.getMonth() - 1); break;
    case '3m': now.setMonth(now.getMonth() - 3); break;
    case '6m': now.setMonth(now.getMonth() - 6); break;
    case 'y': now.setFullYear(now.getFullYear() - 1); break;
    case 'all': now.setFullYear(now.getFullYear() - 100); break;
    default: throw new Error(`Unsupported time frame: ${timeFrame}`);
  }
  return now;
};

export async function GET(_req: NextRequest, { params }: { params: { timeFrame: string } }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id as number;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const timeFrame = params.timeFrame as TimeFrame;

  const coinSummaries = await DBService.getCoinSummaries(userId);
  const timeFrameStartDate = getTimeFrameStartDate(timeFrame);
  const pastCoinSummaries = await DBService.getCoinSummaries(userId, undefined, timeFrameStartDate);

  const timeFramePlByUnit: TimeFramePlByUnitResp = {};

  await Promise.all(
    coinSummaries.map(async (coinSummary) => {
      const priceHistory = await getPriceHistoryForTimeFrame(coinSummary.coinName, timeFrame);
      const startPrice = priceHistory.prices[0][1];
      const curPrice = priceHistory.prices[priceHistory.prices.length - 1][1];

      const curCostBasis = Math.abs(coinSummary.totalBuyCost) - Math.abs(coinSummary.totalSellProfits);
      const curHoldings = coinSummary.holdings;

      const pastCoinSummary = pastCoinSummaries.find((ps) => ps.productName === coinSummary.productName);
      const pastCostBasis = Math.abs(pastCoinSummary?.totalBuyCost || 0) - Math.abs(pastCoinSummary?.totalSellProfits || 0);
      const pastHoldings = pastCoinSummary?.holdings || 0;

      timeFramePlByUnit[coinSummary.productName] = {
        pastPl: startPrice * pastHoldings - pastCostBasis,
        curPl: curPrice * curHoldings - curCostBasis,
        timeFrameStartPrice: startPrice,
      };
    }),
  );

  return NextResponse.json(timeFramePlByUnit);
}
