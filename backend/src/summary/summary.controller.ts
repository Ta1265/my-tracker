import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { TIME_FRAMES } from '../common/time-frame/time-frames';
import { CoinSummaryResponseDto } from './dto/coin-summary-response.dto';
import { PortfolioSummaryResponseDto } from './dto/portfolio-summary-response.dto';
import { ProfitLossChartResponseDto } from './dto/profit-loss-chart-response.dto';
import { SummaryService } from './summary.service';

// Route declaration order matters: Nest matches in declaration order, so every
// literal-segment route (coins, portfolio, profitLossChart, profitLossChart/:timeFrame)
// must come before the :unit param route below, or :unit swallows requests meant for them.
@ApiTags('Summary')
@Controller('summary')
@UseGuards(SessionGuard)
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get('coins')
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'coinSummaries',
    description: "Return a per-coin summary of the caller's portfolio.",
  })
  @ApiOkResponse({ type: CoinSummaryResponseDto, isArray: true })
  async getCoins(@CurrentUser() user: SessionClaims): Promise<CoinSummaryResponseDto[]> {
    return this.summaryService.getCoins(user.sub);
  }

  @Get('portfolio')
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'portfolioSummary',
    description: "Return the caller's aggregate portfolio summary.",
  })
  @ApiOkResponse({ type: PortfolioSummaryResponseDto })
  async getPortfolio(@CurrentUser() user: SessionClaims): Promise<PortfolioSummaryResponseDto> {
    return this.summaryService.getPortfolio(user.sub);
  }

  @Get('profitLossChart')
  @ApiCookieAuth()
  @ApiQuery({
    name: 'timeFrame',
    required: false,
    enum: TIME_FRAMES,
    enumName: 'TimeFrame',
    example: 'all',
    description: "Defaults to 'all'.",
  })
  @ApiOperation({
    operationId: 'profitLossChart',
    description:
      "Return the caller's net cash flow history chart for a time frame. An empty-history " +
      'user gets the fallback shape { netRows: [], lowestPointIndex: 0, highestPointIndex: ' +
      '0 }, not an error.',
  })
  @ApiOkResponse({ type: ProfitLossChartResponseDto })
  async getProfitLossChartByQuery(
    @CurrentUser() user: SessionClaims,
    @Query('timeFrame') timeFrame?: string,
  ): Promise<ProfitLossChartResponseDto> {
    return this.summaryService.getProfitLossChart(user.sub, timeFrame || 'all');
  }

  @Get('profitLossChart/:timeFrame')
  @ApiCookieAuth()
  @ApiParam({ name: 'timeFrame', enum: TIME_FRAMES, enumName: 'TimeFrame', example: 'all' })
  @ApiOperation({
    operationId: 'profitLossChartByTimeFrame',
    description:
      "Return the caller's net cash flow history chart for a time frame (path-param " +
      'variant, identical response to the query variant). An empty-history user gets the ' +
      'fallback shape { netRows: [], lowestPointIndex: 0, highestPointIndex: 0 }, not an ' +
      'error.',
  })
  @ApiOkResponse({ type: ProfitLossChartResponseDto })
  async getProfitLossChartByParam(
    @Param('timeFrame') timeFrame: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<ProfitLossChartResponseDto> {
    return this.summaryService.getProfitLossChart(user.sub, timeFrame);
  }

  @Get(':unit')
  @ApiCookieAuth()
  @ApiParam({ name: 'unit', example: 'BTC' })
  @ApiOperation({
    operationId: 'coinSummariesByUnit',
    description:
      "Return the caller's per-coin summary filtered to a single unit, same shape as " +
      'summary/coins. No known frontend caller today, documented in full regardless.',
  })
  @ApiOkResponse({ type: CoinSummaryResponseDto, isArray: true })
  async getByUnit(
    @Param('unit') unit: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<CoinSummaryResponseDto[]> {
    return this.summaryService.getCoinsByUnit(user.sub, unit);
  }
}
