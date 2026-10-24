import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { SummaryModule } from '../summary/summary.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [AuthModule, SummaryModule, ExchangeRatesModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
