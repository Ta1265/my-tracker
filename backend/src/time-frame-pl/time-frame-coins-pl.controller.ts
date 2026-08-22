import { Controller, Get, NotImplementedException, Param, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import {
  TimeFrameCoinsPlEntryDto,
  TimeFrameCoinsPlResponseDto,
} from './dto/time-frame-coins-pl-response.dto';

@ApiTags('Time-Frame P&L')
@Controller('time-frame-coins-pl')
export class TimeFrameCoinsPlController {
  @Get(':timeFrame')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiExtraModels(TimeFrameCoinsPlEntryDto)
  @ApiParam({ name: 'timeFrame', example: '24h' })
  @ApiOperation({
    description: "Return the caller's per-coin P/L for a time frame, keyed by product name.",
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      additionalProperties: { $ref: getSchemaPath(TimeFrameCoinsPlEntryDto) },
    },
  })
  // Will call dbService.ts's getCoinSummaries twice (current and past) and
  // get-exchange-rates.ts's getPriceHistoryForTimeFrame for the time-frame start price.
  async getByTimeFrame(
    @Param('timeFrame') timeFrame: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<TimeFrameCoinsPlResponseDto> {
    throw new NotImplementedException();
  }
}
