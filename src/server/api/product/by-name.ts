import type { NextApiRequest, NextApiResponse } from 'next';
import type { Transaction } from '@prisma/client';
import { db } from '../../db/db';
import { getServerAuthSession } from '../../auth';
import { type ProductTransaction } from '../../../../types/global';

const formatUSD = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });


interface TaxLot {
  quantity: number;
  costBasis: number;
  date: Date;
}
interface RealizedGains {
  total: number;
  short: number;
  long: number;
}

const calculateFIFOGains = (
  sellQuantity: number,
  sellPrice: number,
  sellDate: Date,
  taxLots: TaxLot[]
): RealizedGains => {
  let remainingToSell = sellQuantity;
  let totalGain = 0;
  let shortTermGain = 0;
  let longTermGain = 0;

  while (remainingToSell > 0 && taxLots.length > 0) {
    const oldestLot = taxLots[0];
    const sellQuantityFromLot = Math.min(remainingToSell, oldestLot.quantity);
    
    // Calculate gain for this portion
    const proceeds = sellQuantityFromLot * sellPrice;
    const costBasisForSale = (oldestLot.costBasis / oldestLot.quantity) * sellQuantityFromLot;
    const gain = proceeds - costBasisForSale;
    
    // Determine holding period (1 year = 365 days)
    const daysDiff = (sellDate.getTime() - oldestLot.date.getTime()) / (1000 * 60 * 60 * 24);
    const isLongTerm = daysDiff > 365;
    
    if (isLongTerm) {
      longTermGain += gain;
    } else {
      shortTermGain += gain;
    }
    totalGain += gain;
    
    // Update lot
    oldestLot.quantity -= sellQuantityFromLot;
    oldestLot.costBasis -= costBasisForSale;
    
    // Remove lot if fully consumed
    if (oldestLot.quantity <= 0.0001) {
      taxLots.shift();
    }
    
    remainingToSell -= sellQuantityFromLot;
  }

  return { total: totalGain, short: shortTermGain, long: longTermGain };
};



const formatTransactions = (transactions: Transaction[]): ProductTransaction[] => {
  // Since transactions come in descending order (newest first), 
  // we need to calculate running balance from oldest to newest
  const transactionsWithBalance: ProductTransaction[] = [];
  let runningBalance = 0;
  let runningCostBasis = 0;
  const taxLots: TaxLot[] = [];
  
  // Process transactions in reverse order (oldest first) to calculate running balance
  for (let i = transactions.length - 1; i >= 0; i--) {
    const transaction = transactions[i];
    let realizedGains: RealizedGains = { total: 0, short: 0, long: 0 };

    // Update running balance based on transaction side
    if (transaction.side === 'BUY') {
      runningBalance += transaction.size;
      runningCostBasis += Math.abs(transaction.total); // Update cost basis for buys

      taxLots.push({
        quantity: transaction.size,
        costBasis: Math.abs(transaction.total),
        date: new Date(transaction.date),
      });

    } else if (transaction.side === 'SELL') {
      runningBalance -= transaction.size;
      runningCostBasis -= Math.abs(transaction.total); // Adjust cost basis for sells

      realizedGains = calculateFIFOGains(
        transaction.size,
        transaction.price,
        new Date(transaction.date),
        taxLots
      );
    }
    
    // Format the transaction with running balance
    const formattedTransaction: ProductTransaction = {
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
      realizedGains: realizedGains,
    };
    
    // Insert at the beginning to maintain descending date order
    transactionsWithBalance.unshift(formattedTransaction);
  }
  
  return transactionsWithBalance;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProductTransaction[] | { error: string }>,
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
