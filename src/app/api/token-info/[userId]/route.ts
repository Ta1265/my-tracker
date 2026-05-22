import { NextRequest, NextResponse } from 'next/server';
import { syncPriceHistoryToDbForUserId } from '@/server/helpers/update-price-history';

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const userId = params.userId ? parseInt(params.userId, 10) : null;
  if (!userId) return NextResponse.json({ error: 'Missing userId param' }, { status: 400 });

  await syncPriceHistoryToDbForUserId(userId);
  return NextResponse.json({ success: true, userId });
}
