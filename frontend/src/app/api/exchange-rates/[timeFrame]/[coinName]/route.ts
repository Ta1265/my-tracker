import { NextRequest, NextResponse } from 'next/server';
import { getPriceHistoryForTimeFrame } from '@/server/helpers/get-exchange-rates';
import { type TimeFrame } from '../../../../../../types/global';

export async function GET(_req: NextRequest, { params }: { params: { timeFrame: string; coinName: string } }) {
  const { timeFrame, coinName } = params;
  const priceData = await getPriceHistoryForTimeFrame(coinName, timeFrame as TimeFrame);
  return NextResponse.json(priceData);
}
