import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PriceHistoryController } from './price-history.controller';
import { PriceHistoryService } from './price-history.service';

@Module({
  imports: [AuthModule],
  controllers: [PriceHistoryController],
  providers: [PriceHistoryService],
})
export class PriceHistoryModule {}
