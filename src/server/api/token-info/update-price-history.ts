import type { NextApiRequest, NextApiResponse } from 'next';
import { getExchangeRates } from '../../helpers/get-exchange-rates';
import { formatUSD } from '../../helpers/format-usd';
import { getServerAuthSession } from '../../auth';
import DBService from '../../db/dbService';
import type { PortfolioSummary } from '../../../../types/global';
import { syncPriceHistoryToDbForUserId } from '../../helpers/update-price-history';


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean, userId: number } | { error: string }>,
) {
  
  const userId = req.query?.userId ? parseInt(req.query.userId as string, 10) : null;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId param' });
  }

  // fetch and store to the db the latest exchange rates from coinbase
  await syncPriceHistoryToDbForUserId(userId);


  res.status(200).json({ success: true, userId });
}
