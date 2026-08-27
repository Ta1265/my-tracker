import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { TIME_FRAMES } from '../common/time-frame/time-frames';
import { TimeFrameTotalPlResponseDto } from './dto/time-frame-total-pl-response.dto';
import { TimeFrameTotalPlService } from './time-frame-total-pl.service';

@ApiTags('Time-Frame P&L')
@Controller('time-frame-total-pl')
export class TimeFrameTotalPlController {
  constructor(private readonly timeFrameTotalPlService: TimeFrameTotalPlService) {}

  @Get(':timeFrame')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiParam({ name: 'timeFrame', enum: TIME_FRAMES, enumName: 'TimeFrame', example: 'd' })
  @ApiOperation({
    operationId: 'timeFrameTotalPl',
    description: "Return the caller's aggregate portfolio P/L for a time frame.",
  })
  @ApiOkResponse({ type: TimeFrameTotalPlResponseDto })
  async getByTimeFrame(
    @Param('timeFrame') timeFrame: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<TimeFrameTotalPlResponseDto> {
    return this.timeFrameTotalPlService.getTotalPl(user.sub, timeFrame);
  }
}
