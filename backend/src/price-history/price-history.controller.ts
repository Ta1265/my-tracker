import { Body, Controller, Get, NotImplementedException, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { PriceHistoryCheckResponseDto } from './dto/price-history-check-response.dto';
import { SetPriceHistoryRequestDto } from './dto/set-price-history-request.dto';
import { SetPriceHistoryResponseDto } from './dto/set-price-history-response.dto';

@ApiTags('Price History')
@Controller('price-history')
export class PriceHistoryController {
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
  // Will check Redis EXISTS under time-frame-pl-{timeFrame}-coinName-{coin} (both
  // segments lowercased), for each coin the caller has transacted in.
  async check(@CurrentUser() user: SessionClaims): Promise<PriceHistoryCheckResponseDto[]> {
    throw new NotImplementedException();
  }

  @Post('set')
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
  // Will call update-price-history.ts's syncPriceHistoryToDbForUserId and cache
  // priceHistoryResp under the coinName/timeFrame key.
  async set(@Body() body: SetPriceHistoryRequestDto): Promise<SetPriceHistoryResponseDto> {
    throw new NotImplementedException();
  }
}
