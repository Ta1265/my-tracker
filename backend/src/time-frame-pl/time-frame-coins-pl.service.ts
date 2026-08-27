import { Injectable } from '@nestjs/common';
import { TimeFrameService } from '../common/time-frame/time-frame.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { SummaryService } from '../summary/summary.service';
import { TimeFrameCoinsPlResponseDto } from './dto/time-frame-coins-pl-response.dto';

@Injectable()
export class TimeFrameCoinsPlService {
  constructor(
    private readonly summaryService: SummaryService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly timeFrameService: TimeFrameService,
  ) {}

  // Ports time-frame-coins-pl/[timeFrame]/route.ts:30-57.
  async getCoinsPl(userId: number, timeFrame: string): Promise<TimeFrameCoinsPlResponseDto> {
    const timeFrameStartDate = this.timeFrameService.getStartDate(timeFrame);
    const [coinSummaries, pastCoinSummaries] = await Promise.all([
      this.summaryService.getCoinSummaries(userId),
      this.summaryService.getCoinSummaries(userId, undefined, timeFrameStartDate),
    ]);

    const result: TimeFrameCoinsPlResponseDto = {};

    await Promise.all(
      coinSummaries.map(async (coinSummary) => {
        const priceHistory = await this.exchangeRatesService.getPriceHistoryForTimeFrame(
          coinSummary.coinName,
          timeFrame,
        );
        const startPrice = priceHistory.prices[0][1];
        const curPrice = priceHistory.prices[priceHistory.prices.length - 1][1];

        const curCostBasis =
          Math.abs(coinSummary.totalBuyCost) - Math.abs(coinSummary.totalSellProfits);
        const curHoldings = coinSummary.holdings;

        const pastCoinSummary = pastCoinSummaries.find(
          (summary) => summary.productName === coinSummary.productName,
        );
        const pastCostBasis =
          Math.abs(pastCoinSummary?.totalBuyCost || 0) -
          Math.abs(pastCoinSummary?.totalSellProfits || 0);
        const pastHoldings = pastCoinSummary?.holdings || 0;

        result[coinSummary.productName] = {
          pastPl: startPrice * pastHoldings - pastCostBasis,
          curPl: curPrice * curHoldings - curCostBasis,
          timeFrameStartPrice: startPrice,
        };
      }),
    );

    return result;
  }
}
