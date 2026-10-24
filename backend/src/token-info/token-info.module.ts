import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { TokenInfoController } from './token-info.controller';
import { TokenInfoService } from './token-info.service';

@Module({
  imports: [AuthModule, ExchangeRatesModule],
  controllers: [TokenInfoController],
  providers: [TokenInfoService],
  exports: [TokenInfoService],
})
export class TokenInfoModule {}
