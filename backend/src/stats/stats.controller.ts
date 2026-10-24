import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { StatsResponseDto } from './dto/stats-response.dto';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get(':unit')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiParam({ name: 'unit', example: 'BTC' })
  @ApiOperation({
    operationId: 'statsByUnit',
    description:
      "Look up the caller's stats for a coin and return a formatted StatsResponseDto. A " +
      'unit with no matching row returns an empty 200 body, not a 404.',
  })
  @ApiOkResponse({ type: StatsResponseDto })
  async getByUnit(
    @Param('unit') unit: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<StatsResponseDto> {
    return this.statsService.getStatsForUnit(user.sub, unit);
  }
}
