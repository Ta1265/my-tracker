
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerAuthSession } from '../../auth';
import { getPriceHistoryForTimeFrame } from '../../helpers/get-exchange-rates';
import DBService from '../../db/dbService';
import { type TimeFramePlByUnitResp, type TimeFrame} from '../../../../types/global';



export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TimeFramePlByUnitResp>,
) {
  const { timeFrame } = req.query as { timeFrame: TimeFrame; };
  
  const session = await getServerAuthSession({ req, res });
  const userId = session?.user?.id as number;

  const coinSummaries = await DBService.getCoinSummaries(userId)

  const timeFramePlByUnit: TimeFramePlByUnitResp = {}

  await Promise.all(
    coinSummaries.map(async (coinSummary) => {
      const priceHistory = await getPriceHistoryForTimeFrame(coinSummary.coinName, timeFrame);
      const startPrice = priceHistory.prices[0][1];
      const curPrice = priceHistory.prices[priceHistory.prices.length - 1][1];
      const costBasis = Math.abs(coinSummary.totalBuyCost) - Math.abs(coinSummary.totalSellProfits);
      const holdings = coinSummary.holdings;

      timeFramePlByUnit[coinSummary.productName] = {
        pastPl: startPrice * holdings - costBasis,
        curPl: curPrice * holdings - costBasis,
        timeFrameStartPrice: startPrice,
      };
    }),
  );

  return res.status(200).json(timeFramePlByUnit);
}
