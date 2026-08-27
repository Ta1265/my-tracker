import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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
import { TIME_FRAMES } from '../common/time-frame/time-frames';
import {
  TimeFrameCoinsPlEntryDto,
  TimeFrameCoinsPlResponseDto,
} from './dto/time-frame-coins-pl-response.dto';
import { TimeFrameCoinsPlService } from './time-frame-coins-pl.service';

@ApiTags('Time-Frame P&L')
@Controller('time-frame-coins-pl')
export class TimeFrameCoinsPlController {
  constructor(private readonly timeFrameCoinsPlService: TimeFrameCoinsPlService) {}

  @Get(':timeFrame')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiExtraModels(TimeFrameCoinsPlEntryDto)
  @ApiParam({ name: 'timeFrame', enum: TIME_FRAMES, enumName: 'TimeFrame', example: 'd' })
  @ApiOperation({
    operationId: 'timeFrameCoinsPl',
    description: "Return the caller's per-coin P/L for a time frame, keyed by product name.",
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      additionalProperties: { $ref: getSchemaPath(TimeFrameCoinsPlEntryDto) },
    },
  })
  async getByTimeFrame(
    @Param('timeFrame') timeFrame: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<TimeFrameCoinsPlResponseDto> {
    return this.timeFrameCoinsPlService.getCoinsPl(user.sub, timeFrame);
  }
}
