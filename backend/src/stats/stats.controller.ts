import { Controller, Get, NotImplementedException, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { StatsResponseDto } from './dto/stats-response.dto';

@ApiTags('Stats')
@Controller('stats')
export class StatsController {
  @Get(':unit')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiParam({ name: 'unit', example: 'BTC' })
  @ApiOperation({
    description: "Look up the caller's stats for a coin and return a formatted StatsResponseDto.",
  })
  @ApiOkResponse({ type: StatsResponseDto })
  // Look up the caller's stats for the coin and return a formatted StatsResponseDto.
  async getByUnit(
    @Param('unit') unit: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<StatsResponseDto> {
    throw new NotImplementedException();
  }
}
