import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerAuthSession } from '../../auth';
import { getExchangeRates, getPriceHistoryForTimeFrame } from '../../helpers/get-exchange-rates';
import DBService from '../../db/dbService';
import { type TimeFrameTotalPlResp, type TimeFrame} from '../../../../types/global';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TimeFrameTotalPlResp>,
) {
  const { timeFrame } = req.query as { timeFrame: TimeFrame; };
  
  const session = await getServerAuthSession({ req, res });
  const userId = session?.user?.id as number;

  await getExchangeRates();
  const coinSummaries = await DBService.getCoinSummaries(userId)

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

  return res.status(200).json({
    pastTotalValue,
    currentTotalValue,
    totalPastPl,
    totalCurPl,
  });
}
