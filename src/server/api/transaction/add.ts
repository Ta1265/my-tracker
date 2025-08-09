import type { NextApiRequest, NextApiResponse } from 'next';
import { unitToNameMap } from '../../helpers/unitToNameMap';
import { db } from '../../db/db';
import { getServerAuthSession } from '../../auth';

interface RequestBody {
  token_id: number,
  side: string;
  unit: string;
  size: string;
  price: string;
  fee: string;
  date: string;
  notes?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  const session = await getServerAuthSession({ req, res });

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    token_id,
    size,
    side,
    price,
    fee,
    date,
    notes = '',
  } = req.body as RequestBody;

  if (!token_id || !size || !price || !fee || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['BUY', 'SELL'].includes(side.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid side' });
  }

  const tokenInfo = await db.tokenInfo.findUnique({
    where: {
      token_id,
    },
  });

  if (!tokenInfo) {
    return res.status(400).json({ error: 'Invalid token_id' });
  }

  let total = parseFloat(size) * parseFloat(price)

  if (side.toUpperCase() === 'BUY') {
    total += parseFloat(fee);
    total = total * -1;
  } else {
    total -= parseFloat(fee);
    total = Math.abs(total);
  }

  await db.transaction.create({
    data: {
      product: `${tokenInfo.symbol.toUpperCase()}-USD`,
      date,
      coinName:
        tokenInfo.slug.charAt(0).toUpperCase() + tokenInfo.slug.slice(1),
      side: side.toUpperCase(),
      size: parseFloat(size),
      unit: tokenInfo.symbol,
      price: parseFloat(price),
      fee: parseFloat(fee),
      total,
      notes,
      userId,
    },
  });

  return res.status(200).send('Transaction added');
}

