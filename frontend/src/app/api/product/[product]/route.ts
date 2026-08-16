import { NextRequest, NextResponse } from 'next/server';
import type { Transaction } from '@prisma/client';
import { db } from '@/server/db/db';
import { getServerAuthSession } from '@/server/auth';
import { type ProductTransaction } from '../../../../../types/global';

const formatUSD = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

interface TaxLot { quantity: number; costBasis: number; date: Date; }
interface RealizedGains { total: number; short: number; long: number; }

const calculateFIFOGains = (
  sellQuantity: number,
  sellPrice: number,
  sellDate: Date,
  taxLots: TaxLot[],
): RealizedGains => {
  let remainingToSell = sellQuantity;
  let totalGain = 0, shortTermGain = 0, longTermGain = 0;
  while (remainingToSell > 0 && taxLots.length > 0) {
    const oldestLot = taxLots[0];
    const qty = Math.min(remainingToSell, oldestLot.quantity);
    const proceeds = qty * sellPrice;
    const costBasisForSale = (oldestLot.costBasis / oldestLot.quantity) * qty;
    const gain = proceeds - costBasisForSale;
    const daysDiff = (sellDate.getTime() - oldestLot.date.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) longTermGain += gain;
    else shortTermGain += gain;
    totalGain += gain;
    oldestLot.quantity -= qty;
    oldestLot.costBasis -= costBasisForSale;
    if (oldestLot.quantity <= 0.0001) taxLots.shift();
    remainingToSell -= qty;
  }
  return { total: totalGain, short: shortTermGain, long: longTermGain };
};

const formatTransactions = (transactions: Transaction[]): ProductTransaction[] => {
  const transactionsWithBalance: ProductTransaction[] = [];
  let runningBalance = 0;
  let runningCostBasis = 0;
  const taxLots: TaxLot[] = [];
  for (let i = transactions.length - 1; i >= 0; i--) {
    const transaction = transactions[i];
    let realizedGains: RealizedGains = { total: 0, short: 0, long: 0 };
    if (transaction.side === 'BUY') {
      runningBalance += transaction.size;
      runningCostBasis += Math.abs(transaction.total);
      taxLots.push({ quantity: transaction.size, costBasis: Math.abs(transaction.total), date: new Date(transaction.date) });
    } else if (transaction.side === 'SELL') {
      runningBalance -= transaction.size;
      runningCostBasis -= Math.abs(transaction.total);
      realizedGains = calculateFIFOGains(transaction.size, transaction.price, new Date(transaction.date), taxLots);
    }
    transactionsWithBalance.unshift({
      id: transaction.id,
      fullName: transaction.coinName,
      product: transaction.product,
      date: new Date(transaction.date).toLocaleString(),
      side: transaction.side,
      size: transaction.size.toString(),
      unit: transaction.unit,
      price: formatUSD(transaction.price),
      fee: formatUSD(transaction.fee),
      total: formatUSD(transaction.total),
      notes: transaction.notes,
      runningBalance: runningBalance.toFixed(4),
      runningCostBasis: formatUSD(runningCostBasis),
      realizedGains,
    });
  }
  return transactionsWithBalance;
};

export async function GET(_req: NextRequest, { params }: { params: { product: string } }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const { product } = params;

  if (!product) return NextResponse.json([], { status: 200 });

  const transactions = await db.transaction.findMany({
    where: { unit: product, userId },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(formatTransactions(transactions));
}
