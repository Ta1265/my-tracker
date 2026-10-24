import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TimeFrameModule } from '../common/time-frame/time-frame.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { SummaryModule } from '../summary/summary.module';
import { TimeFrameCoinsPlController } from './time-frame-coins-pl.controller';
import { TimeFrameCoinsPlService } from './time-frame-coins-pl.service';
import { TimeFrameTotalPlController } from './time-frame-total-pl.controller';
import { TimeFrameTotalPlService } from './time-frame-total-pl.service';

@Module({
  imports: [AuthModule, SummaryModule, ExchangeRatesModule, TimeFrameModule],
  controllers: [TimeFrameCoinsPlController, TimeFrameTotalPlController],
  providers: [TimeFrameCoinsPlService, TimeFrameTotalPlService],
})
export class TimeFramePlModule {}
