import type { NextApiRequest, NextApiResponse } from 'next';
import type { Transaction } from '@prisma/client';
import { db } from '../../db/db';
import { getServerAuthSession } from '../../auth';

const formatUSD = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const formatTransactions = (transactions: Transaction[]) =>
  transactions.map((transaction) => ({
    id: transaction.id,
    fullName: transaction.coinName, //unitToNameMap[transaction.unit],
    product: transaction.product,
    date: new Date(transaction.date).toLocaleString(),
    side: transaction.side,
    size: transaction.size.toFixed(4),
    unit: transaction.unit,
    price: formatUSD(transaction.price),
    fee: formatUSD(transaction.fee),
    total: formatUSD(transaction.total),
    notes: transaction.notes,
  }));

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  const session = await getServerAuthSession({ req, res });
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  const { product } = req.query;

  if (!product || Array.isArray(product)) {
    return [];
  }

  const transactions = await db.transaction.findMany({
    where: { unit: product, userId },
    orderBy: { date: 'desc' },
  });

  const formattedTransactions = formatTransactions(transactions);

  return res.status(200).json(formattedTransactions);
}
