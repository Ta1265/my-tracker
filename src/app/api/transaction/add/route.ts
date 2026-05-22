import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/server/auth';
import { db } from '@/server/db/db';

interface RequestBody {
  token_id: number;
  side: string;
  unit: string;
  size: string;
  price: string;
  fee: string;
  date: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { token_id, size, side, price, fee, date, notes = '' } = (await req.json()) as RequestBody;

  if (!token_id || !size || !price || !fee || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!['BUY', 'SELL'].includes(side.toUpperCase())) {
    return NextResponse.json({ error: 'Invalid side' }, { status: 400 });
  }

  const tokenInfo = await db.tokenInfo.findUnique({ where: { token_id } });
  if (!tokenInfo) return NextResponse.json({ error: 'Invalid token_id' }, { status: 400 });

  let total = parseFloat(size) * parseFloat(price);
  if (side.toUpperCase() === 'BUY') {
    total = (total + parseFloat(fee)) * -1;
  } else {
    total = Math.abs(total - parseFloat(fee));
  }

  await db.transaction.create({
    data: {
      product: `${tokenInfo.symbol.toUpperCase()}-USD`,
      date,
      coinName: tokenInfo.slug.charAt(0).toUpperCase() + tokenInfo.slug.slice(1),
      side: side.toUpperCase(),
      size: parseFloat(size),
      unit: tokenInfo.symbol,
      price: parseFloat(price),
      fee: parseFloat(fee),
      total,
      notes,
      userId,
      token_info_id: +token_id,
    },
  });

  return NextResponse.json('Transaction added');
}
