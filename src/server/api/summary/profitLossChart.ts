import type { NextApiRequest, NextApiResponse } from 'next';
import { formatUSD } from '../../helpers/format-usd';
import { getServerAuthSession } from '../../auth';
import dbService from '../../db/dbService';
import {
  syncPriceHistoryToDbForUserId,
  updateNetCashFlowTableData,
  getNetCashFlowHistory,
} from '../../helpers/update-price-history';
import redisClient from '../../redisClient';
import { type TimeFrame } from '../../../../types/global';

const EXPIRATION = 3600; // 1 hour ms

async function refreshData(userId: number, timeFrame: TimeFrame = 'all',forceRefresh = false) {
  const cacheKey = `sync-price-history-${userId}-${timeFrame}`;

  const skip = await redisClient.get(cacheKey);
  if (skip && !forceRefresh) {
    console.log(`Skipping price history data refresh for userId ${userId} and timeFrame ${timeFrame} due to recent sync.`);
    return;
  }

  await redisClient.setex(cacheKey, EXPIRATION, JSON.stringify(true));

  try {
    await syncPriceHistoryToDbForUserId(userId, timeFrame);
    console.log(`Completed price history re-sync for userId ${userId} and timeFrame ${timeFrame}.`);

    await updateNetCashFlowTableData(userId, timeFrame);
    console.log(`Completed net cash flow re-sync for userId ${userId} and timeFrame ${timeFrame}.`);
  } catch (error) {
    console.error(`Error during price history refresh for userId ${userId}:`, error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerAuthSession({ req, res })
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const timeFrame = (req.query.timeFrame || 'all') as TimeFrame;

  const userId = session.user.id;
  // const userId = 1; // TEMP

  const cacheKey = `net-cash-flow-history-${userId}-${timeFrame}`;

  let cacheData = await redisClient.get(cacheKey);
  
  if (cacheData) {
    console.log(`Cache hit for net cash flow history for userId ${userId} and timeFrame ${timeFrame}`);
    res.status(200).json(JSON.parse(cacheData));
    return;
  }

  console.log(`Cache miss for net cash flow history for userId ${userId} and timeFrame ${timeFrame}`);

  const data = await getNetCashFlowHistory(userId, timeFrame) || [];

  await redisClient.setex(cacheKey, EXPIRATION, JSON.stringify(data));

  res.status(200).json(data);

}


// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   const session = await getServerAuthSession({ req, res })
//   if (!session || !session.user) {
//     return res.status(401).json({ error: 'Unauthorized' });
//   }

//   const timeFrame = (req.query.timeFrame || 'all') as TimeFrame;

//   const userId = session.user.id;

//   const data = await dbService.getNetCashFlowHistory(userId, timeFrame);
  
//   let responseSent = false;

//   if (data?.length) {
//     responseSent = true; 
//     res.status(200).json(data);
//   }

//   const forceRefresh = !responseSent

//   // Trigger possible data refresh, but don't wait for it to complete before responding
//   await refreshData(userId, timeFrame, forceRefresh).catch((error) => {
//     console.error('Error refreshing data:', error);
//   });

//   if (!responseSent) {
//     const reTryData = await dbService.getNetCashFlowHistory(userId, timeFrame);
//     res.status(200).json(reTryData);
//   }
// }