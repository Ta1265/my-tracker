import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { formatUsdPrecise } from '../common/formatting/format-usd';
import { Transaction } from '../db/entities/transaction.entity';
import { ProductTransactionResponseDto } from './dto/product-transaction-response.dto';

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

@Injectable()
export class ProductService {
  constructor(private readonly em: EntityManager) {}

  async getTransactionsForProduct(
    userId: number,
    product: string,
  ): Promise<ProductTransactionResponseDto[]> {
    if (!product) {
      return [];
    }

    // route.ts filters on `unit`, not `product`, despite the path param being named
    // `product` - reproduced verbatim.
    const transactions = await this.em.find(
      Transaction,
      { unit: product, userId },
      { orderBy: { date: 'desc' } },
    );

    return this.formatTransactions(transactions);
  }

  // Ported verbatim from product/[product]/route.ts:13-37. FIFO lot matching against
  // a SELL: consumes the oldest lots first, splitting the gain on each lot into
  // short/long term at the 365-day mark.
  private calculateFIFOGains(
    sellQuantity: number,
    sellPrice: number,
    sellDate: Date,
    taxLots: TaxLot[],
  ): RealizedGains {
    let remainingToSell = sellQuantity;
    let totalGain = 0;
    let shortTermGain = 0;
    let longTermGain = 0;

    while (remainingToSell > 0 && taxLots.length > 0) {
      const oldestLot = taxLots[0];
      const qty = Math.min(remainingToSell, oldestLot.quantity);
      const proceeds = qty * sellPrice;
      const costBasisForSale = (oldestLot.costBasis / oldestLot.quantity) * qty;
      const gain = proceeds - costBasisForSale;
      const daysDiff = (sellDate.getTime() - oldestLot.date.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff > 365) {
        longTermGain += gain;
      } else {
        shortTermGain += gain;
      }
      totalGain += gain;

      oldestLot.quantity -= qty;
      oldestLot.costBasis -= costBasisForSale;
      if (oldestLot.quantity <= 0.0001) {
        taxLots.shift();
      }
      remainingToSell -= qty;
    }

    return { total: totalGain, short: shortTermGain, long: longTermGain };
  }

  // Ported verbatim from product/[product]/route.ts:39-74. Walks the `desc`-ordered
  // array oldest-to-newest (i.e. in reverse) to build running balance/cost-basis and
  // FIFO tax lots, then `unshift`s each formatted row back into most-recent-first order.
  private formatTransactions(transactions: Transaction[]): ProductTransactionResponseDto[] {
    const transactionsWithBalance: ProductTransactionResponseDto[] = [];
    let runningBalance = 0;
    let runningCostBasis = 0;
    const taxLots: TaxLot[] = [];

    for (let i = transactions.length - 1; i >= 0; i--) {
      const transaction = transactions[i];
      let realizedGains: RealizedGains = { total: 0, short: 0, long: 0 };

      if (transaction.side === 'BUY') {
        runningBalance += transaction.size;
        runningCostBasis += Math.abs(transaction.total);
        taxLots.push({
          quantity: transaction.size,
          costBasis: Math.abs(transaction.total),
          date: new Date(transaction.date),
        });
      } else if (transaction.side === 'SELL') {
        runningBalance -= transaction.size;
        runningCostBasis -= Math.abs(transaction.total);
        realizedGains = this.calculateFIFOGains(
          transaction.size,
          transaction.price,
          new Date(transaction.date),
          taxLots,
        );
      }

      transactionsWithBalance.unshift({
        id: transaction.id,
        fullName: transaction.coinName,
        product: transaction.product,
        date: new Date(transaction.date).toLocaleString(),
        side: transaction.side,
        size: transaction.size.toString(),
        unit: transaction.unit,
        price: formatUsdPrecise(transaction.price),
        fee: formatUsdPrecise(transaction.fee),
        total: formatUsdPrecise(transaction.total),
        notes: transaction.notes,
        runningBalance: runningBalance.toFixed(4),
        runningCostBasis: formatUsdPrecise(runningCostBasis),
        realizedGains,
      });
    }

    return transactionsWithBalance;
  }
}
