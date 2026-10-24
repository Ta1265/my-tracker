import { Injectable } from '@nestjs/common';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { SummaryService } from '../summary/summary.service';
import { TimeFrameTotalPlResponseDto } from './dto/time-frame-total-pl-response.dto';

@Injectable()
export class TimeFrameTotalPlService {
  constructor(
    private readonly summaryService: SummaryService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  // Ports time-frame-total-pl/[timeFrame]/route.ts:14-36. No date-range arithmetic
  // here - only a cached past price lookup by timeframe key - so this does not use
  // TimeFrameService.
  async getTotalPl(userId: number, timeFrame: string): Promise<TimeFrameTotalPlResponseDto> {
    await this.exchangeRatesService.refreshRates();
    const coinSummaries = await this.summaryService.getCoinSummaries(userId);

    let pastTotalValue = 0;
    let currentTotalValue = 0;
    let totalPastPl = 0;
    let totalCurPl = 0;

    await Promise.all(
      coinSummaries.map(async (coinSummary) => {
        const priceHistory = await this.exchangeRatesService.getPriceHistoryForTimeFrame(
          coinSummary.coinName,
          timeFrame,
        );
        const startPrice = priceHistory.prices[0][1];
        const curPrice = coinSummary.currentPrice;
        const costBasis =
          Math.abs(coinSummary.totalBuyCost) - Math.abs(coinSummary.totalSellProfits);
        const holdings = coinSummary.holdings;

        pastTotalValue += startPrice * holdings;
        currentTotalValue += curPrice * holdings;
        totalPastPl += startPrice * holdings - costBasis;
        totalCurPl += curPrice * holdings - costBasis;
      }),
    );

    return { pastTotalValue, currentTotalValue, totalPastPl, totalCurPl };
  }
}
