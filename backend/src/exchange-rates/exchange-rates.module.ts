import { Module } from '@nestjs/common';
import { ExchangeRatesController } from './exchange-rates.controller';

@Module({
  controllers: [ExchangeRatesController],
})
export class ExchangeRatesModule {}
