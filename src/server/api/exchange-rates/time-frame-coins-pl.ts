
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerAuthSession } from '../../auth';
import { getPriceHistoryForTimeFrame } from '../../helpers/get-exchange-rates';
import DBService, { CoinSummary } from '../../db/dbService';
import { type TimeFramePlByUnitResp, type TimeFrame } from '../../../../types/global';



const getTimeFrameStartDate = (timeFrame: TimeFrame): Date => {
  const now = new Date();
  switch (timeFrame) {
    case 'h':
      now.setHours(now.getHours() - 1);
      break;
    case 'd':
      now.setDate(now.getDate() - 1);
      break;
    case 'w':
      now.setDate(now.getDate() - 7);
      break;
    case 'm':
      now.setMonth(now.getMonth() - 1);
      break;
    case '3m':
      now.setMonth(now.getMonth() - 3);
      break;
    case '6m':
      now.setMonth(now.getMonth() - 6);
      break;
    case 'y':
      now.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
      now.setFullYear(now.getFullYear() - 100); // Arbitrary large number to cover "all" time frame
      break;
    default:
      throw new Error(`Unsupported time frame: ${timeFrame}`);
  }
  return now;
};

function findPl(coinSummary: CoinSummary, price: number) {
  const costBasis = Math.abs(coinSummary.totalBuyCost) - Math.abs(coinSummary.totalSellProfits);
  const holdings = coinSummary.holdings;

  return price * holdings - costBasis;
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TimeFramePlByUnitResp>,
) {
  const { timeFrame } = req.query as { timeFrame: TimeFrame; };

  const session = await getServerAuthSession({ req, res });
  const userId = session?.user?.id as number;


  const coinSummaries = await DBService.getCoinSummaries(userId)

  const timeFrameStartDate = getTimeFrameStartDate(timeFrame);

  const pastCoinSummaries = await DBService.getCoinSummaries(userId, undefined, timeFrameStartDate);


  const timeFramePlByUnit: TimeFramePlByUnitResp = {}

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

      // timeFramePlByUnit[coinSummary.productName] = {
      //   pastPl: startPrice * holdings - costBasis,
      //   curPl: curPrice * holdings - costBasis,
      //   timeFrameStartPrice: startPrice,
      // };
    }),
  );

  return res.status(200).json(timeFramePlByUnit);
}
