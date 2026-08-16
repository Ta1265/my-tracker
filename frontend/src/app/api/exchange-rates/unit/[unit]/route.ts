import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRates } from '@/server/helpers/get-exchange-rates';
import { formatUSD } from '@/server/helpers/format-usd';
import { db } from '@/server/db/db';

export async function GET(_req: NextRequest, { params }: { params: { unit: string } }) {
  const { unit } = params;
  await getExchangeRates();
  const exchangeRate = await db.exchangeRate.findFirst({ where: { unit } });
  if (!exchangeRate) {
    return NextResponse.json('Exchange rate not found', { status: 404 });
  }
  return NextResponse.json(formatUSD(exchangeRate.rate));
}
