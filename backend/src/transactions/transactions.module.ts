import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [AuthModule],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
