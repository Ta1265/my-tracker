import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { TokenInfoModule } from '../token-info/token-info.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  imports: [AuthModule, ExchangeRatesModule, TokenInfoModule],
  controllers: [SummaryController],
  providers: [SummaryService],
  exports: [SummaryService],
})
export class SummaryModule {}
