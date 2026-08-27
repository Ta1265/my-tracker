import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { formatUSD } from '../common/formatting/format-usd';
import { TIME_FRAMES } from '../common/time-frame/time-frames';
import { PriceHistoryResponseDto } from './dto/price-history-response.dto';
import { ExchangeRatesService } from './exchange-rates.service';

@ApiTags('Exchange Rates')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  // Registered ahead of `:timeFrame/:coinName` below: Nest (via Express) matches routes
  // in declaration order, and `unit/:unit` is a literal segment that `:timeFrame` would
  // otherwise shadow (`GET .../unit/BTC` would match `:timeFrame='unit', coinName='BTC'`
  // first and never reach this handler).
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
  // Writes the response directly via `@Res({ passthrough: false })` so a bare JSON
  // string reaches the client, rather than AllExceptionsFilter's `{ error }` wrapping.
  // `refreshRates()` runs first and is left unguarded on purpose - if it
  // throws, nothing has been written to `res` yet, so the exception still reaches
  // AllExceptionsFilter's normal 500 path instead of colliding with a response already
  // in flight.
  async getByUnit(
    @Param('unit') unit: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    await this.exchangeRatesService.refreshRates();
    const rate = await this.exchangeRatesService.getRateForUnit(unit);

    if (!rate) {
      res.status(404).json('Exchange rate not found');
      return;
    }

    res.status(200).json(formatUSD(rate.rate));
  }

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
  async getPriceHistory(
    @Param('timeFrame') timeFrame: string,
    @Param('coinName') coinName: string,
  ): Promise<PriceHistoryResponseDto> {
    return this.exchangeRatesService.getPriceHistoryForTimeFrame(coinName, timeFrame);
  }
}
