import { Controller, Get, NotImplementedException, Param, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CoinSummaryResponseDto } from './dto/coin-summary-response.dto';
import { PortfolioSummaryResponseDto } from './dto/portfolio-summary-response.dto';
import { ProfitLossChartResponseDto } from './dto/profit-loss-chart-response.dto';

// Route declaration order matters: Nest matches in declaration order, so every
// literal-segment route (coins, portfolio, profitLossChart, profitLossChart/:timeFrame)
// must come before the :unit param route below, or :unit swallows requests meant for them.
@ApiTags('Summary')
@Controller('summary')
export class SummaryController {
  @Get('coins')
  @ApiCookieAuth()
  @ApiOperation({
    description: "Return a per-coin summary of the caller's portfolio.",
  })
  @ApiOkResponse({ type: CoinSummaryResponseDto, isArray: true })
  // Will call dbService.ts's getCoinSummaries(userId).
  async getCoins(): Promise<CoinSummaryResponseDto[]> {
    throw new NotImplementedException();
  }

  @Get('portfolio')
  @ApiCookieAuth()
  @ApiOperation({
    description: "Return the caller's aggregate portfolio summary.",
  })
  @ApiOkResponse({ type: PortfolioSummaryResponseDto })
  // Will call dbService.ts's getPortfolioSummary(userId).
  async getPortfolio(): Promise<PortfolioSummaryResponseDto> {
    throw new NotImplementedException();
  }

  @Get('profitLossChart')
  @ApiCookieAuth()
  @ApiQuery({
    name: 'timeFrame',
    required: false,
    example: 'all',
    description: "Defaults to 'all'.",
  })
  @ApiOperation({
    description:
      "Return the caller's net cash flow history chart for a time frame. An empty-history " +
      'user gets the fallback shape { netRows: [], lowestPointIndex: 0, highestPointIndex: ' +
      '0 }, not an error.',
  })
  @ApiOkResponse({ type: ProfitLossChartResponseDto })
  // Will call update-price-history.ts's getNetCashFlowHistory(userId, timeFrame) - not
  // the different, same-named function in dbService.ts.
  async getProfitLossChartByQuery(
    @Query('timeFrame') timeFrame = 'all',
  ): Promise<ProfitLossChartResponseDto> {
    throw new NotImplementedException();
  }

  @Get('profitLossChart/:timeFrame')
  @ApiCookieAuth()
  @ApiParam({ name: 'timeFrame', example: 'all' })
  @ApiOperation({
    description:
      "Return the caller's net cash flow history chart for a time frame (path-param " +
      'variant, identical response to the query variant). An empty-history user gets the ' +
      'fallback shape { netRows: [], lowestPointIndex: 0, highestPointIndex: 0 }, not an ' +
      'error.',
  })
  @ApiOkResponse({ type: ProfitLossChartResponseDto })
  // Will call update-price-history.ts's getNetCashFlowHistory(userId, timeFrame) - not
  // the different, same-named function in dbService.ts.
  async getProfitLossChartByParam(
    @Param('timeFrame') timeFrame: string,
  ): Promise<ProfitLossChartResponseDto> {
    throw new NotImplementedException();
  }

  @Get(':unit')
  @ApiCookieAuth()
  @ApiParam({ name: 'unit', example: 'BTC' })
  @ApiOperation({
    description:
      "Return the caller's per-coin summary filtered to a single unit, same shape as " +
      'summary/coins. No known frontend caller today, documented in full regardless.',
  })
  @ApiOkResponse({ type: CoinSummaryResponseDto, isArray: true })
  // Will call dbService.ts's getCoinSummaries(userId, unit).
  async getByUnit(@Param('unit') unit: string): Promise<CoinSummaryResponseDto[]> {
    throw new NotImplementedException();
  }
}
