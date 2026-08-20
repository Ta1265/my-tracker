import { Module } from '@nestjs/common';
import { PriceHistoryController } from './price-history.controller';

@Module({
  controllers: [PriceHistoryController],
})
export class PriceHistoryModule {}
