import { NextRequest, NextResponse } from 'next/server';
import { type TimeFrame } from '../../../../../types/global';
import redisClient from '@/server/redisClient';
import db from '@/server/db/dbService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';

const timeFrames: TimeFrame[] = ['h', 'd', 'w', 'm', '3m', '6m', 'y', 'all'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as number;

  const coins = await db.getUsersCoins(userId);
  const cachesNeedingUpdate: { coinName: string; timeFramesNeeded: TimeFrame[] }[] = [];

  await Promise.all(
    coins.map(async ({ coinName }) => {
      const coin = { coinName, timeFramesNeeded: [] as TimeFrame[] };
      await Promise.all(
        timeFrames.map(async (timeFrame) => {
          const cacheKey = `time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}`;
          const cacheValue = await redisClient.exists(cacheKey);
          if (!cacheValue) coin.timeFramesNeeded.push(timeFrame);
        }),
      );
      cachesNeedingUpdate.push(coin);
    }),
  );

  return NextResponse.json(cachesNeedingUpdate);
}
