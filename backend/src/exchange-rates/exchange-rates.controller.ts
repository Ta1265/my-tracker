import { Controller, Get, NotImplementedException, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TIME_FRAMES } from '../common/time-frame/time-frames';
import { PriceHistoryResponseDto } from './dto/price-history-response.dto';

@ApiTags('Exchange Rates')
@Controller('exchange-rates')
export class ExchangeRatesController {
  @Get(':timeFrame/:coinName')
  @ApiParam({ name: 'timeFrame', enum: TIME_FRAMES, enumName: 'TimeFrame', example: 'd' })
  @ApiParam({ name: 'coinName', example: 'Bitcoin' })
  @ApiOperation({
    operationId: 'coinPriceHistory',
    description:
      'Deliberately public: returns market price history for a coin, not anything scoped to ' +
      'the caller. No auth today; stays public.',
  })
  @ApiOkResponse({ type: PriceHistoryResponseDto })
  // Will call get-exchange-rates.ts's getPriceHistoryForTimeFrame(coinName, timeFrame).
  async getPriceHistory(
    @Param('timeFrame') timeFrame: string,
    @Param('coinName') coinName: string,
  ): Promise<PriceHistoryResponseDto> {
    throw new NotImplementedException();
  }

  @Get('unit/:unit')
  @ApiParam({ name: 'unit', example: 'BTC' })
  @ApiOperation({
    operationId: 'exchangeRatesByUnit',
    description:
      'Deliberately public: returns a market exchange rate, not anything scoped to the ' +
      'caller. No auth today; stays public.',
  })
  @ApiResponse({
    status: 200,
    description: 'formatUSD-formatted exchange rate, as a bare JSON string (not a wrapped object).',
    schema: { type: 'string' },
    example: '"$1,235"',
  })
  @ApiResponse({
    status: 404,
    description: 'No ExchangeRate row for the unit, as a bare JSON string (not a wrapped object).',
    schema: { type: 'string' },
    example: '"Exchange rate not found"',
  })
  // Will look up the ExchangeRate row for the unit and format it via format-usd.ts's formatUSD.
  async getByUnit(@Param('unit') unit: string): Promise<string> {
    throw new NotImplementedException();
  }
}
