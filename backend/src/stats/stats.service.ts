import { Injectable } from '@nestjs/common';
import { formatUSD } from '../common/formatting/format-usd';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { SummaryService } from '../summary/summary.service';
import { StatsResponseDto } from './dto/stats-response.dto';

@Injectable()
export class StatsService {
  constructor(
    private readonly summaryService: SummaryService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  // Ports stats/[unit]/route.ts's formatStats + truncation-to-first-row behavior
  // verbatim: getCoinSummaries is unit-filtered, so it returns at most one row, but the
  // route always reads index 0 rather than asserting a single row. A unit with no
  // matching row yields `undefined` here, which the controller returns as-is.
  async getStatsForUnit(userId: number, unit: string): Promise<StatsResponseDto> {
    await this.exchangeRatesService.refreshRates();
    const unitSummaries = await this.summaryService.getCoinSummaries(userId, unit);

    const formatted = unitSummaries.map((stat) => ({
      productName: stat.productName,
      avgPurchasePrice: formatUSD(stat.avgPurchasePrice),
      avgSellPrice: formatUSD(stat.avgSellPrice),
      holdings: stat.holdings.toFixed(4),
      valueOfHoldings: formatUSD(stat.valueOfHoldings),
      profitLossAtCurrentPrice: formatUSD(stat.profitLossAtCurrentPrice),
      percentPL: stat.percentPL.toFixed(1) + '%',
      currentPrice: formatUSD(stat.currentPrice),
      breakEvenPrice: formatUSD(stat.breakEvenPrice),
    }));

    return formatted[0];
  }
}
