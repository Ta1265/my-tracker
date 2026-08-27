import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { PriceHistoryCheckResponseDto } from './dto/price-history-check-response.dto';
import { SetPriceHistoryRequestDto } from './dto/set-price-history-request.dto';
import { SetPriceHistoryResponseDto } from './dto/set-price-history-response.dto';
import { PriceHistoryService } from './price-history.service';

@ApiTags('Price History')
@Controller('price-history')
export class PriceHistoryController {
  constructor(private readonly priceHistoryService: PriceHistoryService) {}

  @Get('check')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'priceHistoryCheck',
    description:
      'Return, per coin the caller has transacted in, which time frames are missing from ' +
      'the price-history cache. Requires a session; returns 401 if none is present.',
  })
  @ApiOkResponse({ type: PriceHistoryCheckResponseDto, isArray: true })
  @ApiResponse({
    status: 401,
    description: 'No session.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Unauthorized' },
    },
  })
  async check(@CurrentUser() user: SessionClaims): Promise<PriceHistoryCheckResponseDto[]> {
    return this.priceHistoryService.checkCoverage(user.sub);
  }

  @Post('set')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'setPriceHistory',
    description:
      'Deliberately public: writes a shared price-history cache entry keyed by ' +
      'coin/timeFrame, not anything scoped to the caller. No session read today; stays ' +
      'public.',
  })
  @ApiOkResponse({ type: SetPriceHistoryResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Missing coinName, timeFrame, or priceHistoryResp.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Missing required fields' },
    },
  })
  async set(@Body() body: SetPriceHistoryRequestDto): Promise<SetPriceHistoryResponseDto> {
    const message = await this.priceHistoryService.setEntry(
      body.coinName,
      body.timeFrame,
      body.priceHistoryResp,
    );
    return { message };
  }
}
