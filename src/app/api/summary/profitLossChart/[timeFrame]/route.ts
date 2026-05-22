import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/server/auth';
import { getNetCashFlowHistory, syncPriceHistoryToDbForUserId, updateNetCashFlowTableData } from '@/server/helpers/update-price-history';
import redisClient from '@/server/redisClient';
import { type TimeFrame } from '../../../../../../types/global';

const EXPIRATION = 3600;

async function refreshData(userId: number, timeFrame: TimeFrame = 'all', forceRefresh = false) {
  const cacheKey = `sync-price-history-${userId}-${timeFrame}`;
  const skip = await redisClient.get(cacheKey);
  if (skip && !forceRefresh) return;
  await redisClient.setex(cacheKey, EXPIRATION, JSON.stringify(true));
  try {
    await syncPriceHistoryToDbForUserId(userId, timeFrame);
    await updateNetCashFlowTableData(userId, timeFrame);
  } catch (error) {
    console.error(`Error during price history refresh for userId ${userId}:`, error);
  }
}

export async function GET(_req: NextRequest, { params }: { params: { timeFrame: string } }) {
  const session = await getServerAuthSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const timeFrame = (params.timeFrame || 'all') as TimeFrame;
  const userId = session.user.id;

  const cacheKey = `net-cash-flow-history-${userId}-${timeFrame}`;
  const cacheData = await redisClient.get(cacheKey);
  if (cacheData) {
    return NextResponse.json(JSON.parse(cacheData));
  }

  const data = await getNetCashFlowHistory(userId, timeFrame) || { netRows: [], lowestPointIndex: 0, highestPointIndex: 0 };
  await redisClient.setex(cacheKey, EXPIRATION, JSON.stringify(data));

  return NextResponse.json(data);
}
