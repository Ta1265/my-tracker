import type { NextApiRequest, NextApiResponse } from 'next';
import { type TimeFrame, type PriceHistoryResp } from '../../../../types/global';
import redisClient from '../../../server/redisClient';

export interface PriceHistoryCachePostBody {
  coinName: string;
  timeFrame: TimeFrame;
  priceHistoryResp: PriceHistoryResp;
}

const minute = 60;
const hour = 60 * minute;
const day = hour * 24;

const cacheExpirationForTimeFrame = {
  h: 10 * minute,
  d: 1 * hour,
  w: 1 * day,
  m: 1 * day,
  '3m': 1 * day,
  '6m': 1 * day,
  y: 1 * day,
  all: 1 * day,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { timeFrame, priceHistoryResp, coinName } = req.body as PriceHistoryCachePostBody;

  if (!timeFrame || !priceHistoryResp || !coinName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const cacheKey = `time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}`;

  const expiration = cacheExpirationForTimeFrame[timeFrame];

  await redisClient.setex(cacheKey, expiration, JSON.stringify(priceHistoryResp));

  return res
    .status(200)
    .json({ message: `Price history cached successfully: ${coinName} - ${timeFrame}` });
}
