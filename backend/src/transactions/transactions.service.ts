import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TokenInfo } from '../db/entities/token-info.entity';
import { Transaction } from '../db/entities/transaction.entity';
import { TransactionAddRequestDto } from './dto/transaction-add-request.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly em: EntityManager) {}

  async addTransaction(userId: number, body: TransactionAddRequestDto): Promise<void> {
    const { token_id, side, size, price, fee, date, notes } = body;

    if (!token_id || !size || !price || !fee || !date) {
      throw new BadRequestException('Missing required fields');
    }

    const upperSide = side.toUpperCase();
    if (upperSide !== 'BUY' && upperSide !== 'SELL') {
      throw new BadRequestException('Invalid side');
    }

    const tokenInfo = await this.em.getRepository(TokenInfo).findOne({ token_id });
    if (!tokenInfo) {
      throw new BadRequestException('Invalid token_id');
    }

    let total = parseFloat(size) * parseFloat(price);
    total =
      upperSide === 'BUY' ? (total + parseFloat(fee)) * -1 : Math.abs(total - parseFloat(fee));

    // `em.create()` marks the entity for persistence automatically in this MikroORM
    // version (no standalone `persistAndFlush` API), so `flush()` alone commits it.
    this.em.create(Transaction, {
      product: `${tokenInfo.symbol!.toUpperCase()}-USD`,
      date: new Date(date),
      coinName: tokenInfo.slug!.charAt(0).toUpperCase() + tokenInfo.slug!.slice(1),
      side: upperSide,
      size: parseFloat(size),
      unit: tokenInfo.symbol!,
      price: parseFloat(price),
      fee: parseFloat(fee),
      total,
      notes: notes ?? '',
      userId,
      token_info_id: +token_id,
    });
    await this.em.flush();
  }

  // `nativeDelete` returns an affected-row count rather than throwing on a miss, so the
  // zero-affected branch folds a genuine miss, a throw, and a foreign-owned row into one 500.
  async deleteTransaction(id: number, userId: number): Promise<void> {
    let affected: number;
    try {
      affected = await this.em.nativeDelete(Transaction, { id, userId });
    } catch {
      affected = 0;
    }

    if (affected === 0) {
      throw new InternalServerErrorException('An error occurred while deleting the transaction');
    }
  }
}
