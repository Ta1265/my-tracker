import { Controller, Get, NotImplementedException, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { TimeFrameTotalPlResponseDto } from './dto/time-frame-total-pl-response.dto';

@ApiTags('Time-Frame P&L')
@Controller('time-frame-total-pl')
export class TimeFrameTotalPlController {
  @Get(':timeFrame')
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
  ): Promise<TimeFrameTotalPlResponseDto> {
    throw new NotImplementedException();
  }
}
