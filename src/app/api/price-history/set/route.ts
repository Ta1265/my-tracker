import { NextRequest, NextResponse } from 'next/server';
import { type TimeFrame } from '../../../../../types/global';
import redisClient from '@/server/redisClient';

type PriceHistoryResp = {
  prices: Array<[unixTimestamp: number, openPrice: number, closePrice: number]>;
  price_change: number;
  usd_price_change: number;
};

const minute = 60, hour = 60 * minute, day = hour * 24;
const cacheExpirationForTimeFrame: Record<TimeFrame, number> = {
  h: 10 * minute, d: 1 * hour, w: 1 * day, m: 1 * day,
  '3m': 1 * day, '6m': 1 * day, y: 1 * day, all: 1 * day,
};

export async function POST(req: NextRequest) {
  const { timeFrame, priceHistoryResp, coinName } = await req.json() as {
    coinName: string; timeFrame: TimeFrame; priceHistoryResp: PriceHistoryResp;
  };

  if (!timeFrame || !priceHistoryResp || !coinName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const cacheKey = `time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}`;
  await redisClient.setex(cacheKey, cacheExpirationForTimeFrame[timeFrame], JSON.stringify(priceHistoryResp));

  return NextResponse.json({ message: `Price history cached successfully: ${coinName} - ${timeFrame}` });
}
