import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PriceHistoryController } from './price-history.controller';

@Module({
  imports: [AuthModule],
  controllers: [PriceHistoryController],
})
export class PriceHistoryModule {}
