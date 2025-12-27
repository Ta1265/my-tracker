import type { NextApiRequest, NextApiResponse } from 'next';
import { type TimeFrame, type PriceHistoryResp } from '../../../../types/global';
import redisClient from '../../../server/redisClient';
import { getServerAuthSession } from '../../../server/auth';
import db from '../../../server/db/dbService';

export interface PriceHistoryCachePostBody {
  coinName: string;
  timeFrame: TimeFrame;
  priceHistoryResp: PriceHistoryResp;
}

const timeFrames: TimeFrame[] = ['h', 'd', 'w', 'm', '3m', '6m', 'y', 'all'];

interface CoinCache {
  coinName: string;
  timeFramesNeeded: TimeFrame[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<CoinCache[]>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerAuthSession({ req, res });
  const userId = session?.user?.id as number;

  const coins = await db.getUsersCoins(userId);

  const cachesNeedingUpdate: CoinCache[] = [];

  await Promise.all(
    coins.map(async ({ coinName }) => {
      const coin: CoinCache = { coinName, timeFramesNeeded: [] };
      await Promise.all(
        timeFrames.map(async (timeFrame) => {
          const cacheKey = `time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}`;
          const cacheValue = await redisClient.exists(cacheKey);
          if (!cacheValue) {
            coin.timeFramesNeeded.push(timeFrame);
          }
        }),
      );
      cachesNeedingUpdate.push(coin);
    }),
  );

  return res.status(200).json(cachesNeedingUpdate);
}
