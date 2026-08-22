import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { ClockModule } from './common/clock/clock.module';
import { RequestClsModule } from './common/cls/cls.module';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { HealthController } from './health/health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { PriceHistoryModule } from './price-history/price-history.module';
import { ProductModule } from './product/product.module';
import { StatsModule } from './stats/stats.module';
import { SummaryModule } from './summary/summary.module';
import { TimeFramePlModule } from './time-frame-pl/time-frame-pl.module';
import { TokenInfoModule } from './token-info/token-info.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    AppConfigModule,
    ClockModule,
    RequestClsModule,
    DbModule,
    AuthModule,
    TransactionsModule,
    SummaryModule,
    StatsModule,
    ProductModule,
    ExchangeRatesModule,
    PriceHistoryModule,
    TimeFramePlModule,
    TokenInfoModule,
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
