import { Controller, Get, NotImplementedException, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { TimeFrameTotalPlResponseDto } from './dto/time-frame-total-pl-response.dto';

@ApiTags('Time-Frame P&L')
@Controller('time-frame-total-pl')
export class TimeFrameTotalPlController {
  @Get(':timeFrame')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiParam({ name: 'timeFrame', example: '24h' })
  @ApiOperation({
    description: "Return the caller's aggregate portfolio P/L for a time frame.",
  })
  @ApiOkResponse({ type: TimeFrameTotalPlResponseDto })
  // Will call dbService.ts's getCoinSummaries and get-exchange-rates.ts's
  // getPriceHistoryForTimeFrame for the time-frame start price.
  async getByTimeFrame(
    @Param('timeFrame') timeFrame: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<TimeFrameTotalPlResponseDto> {
    throw new NotImplementedException();
  }
}
