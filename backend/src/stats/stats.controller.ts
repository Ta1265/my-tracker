import { Controller, Get, NotImplementedException, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { StatsResponseDto } from './dto/stats-response.dto';

@ApiTags('Stats')
@Controller('stats')
export class StatsController {
  @Get(':unit')
  @ApiCookieAuth()
  @ApiParam({ name: 'unit', example: 'BTC' })
  @ApiOperation({
    description: "Look up the caller's stats for a coin and return a formatted StatsResponseDto.",
  })
  @ApiOkResponse({ type: StatsResponseDto })
  // Look up the caller's stats for the coin and return a formatted StatsResponseDto.
  async getByUnit(@Param('unit') unit: string): Promise<StatsResponseDto> {
    throw new NotImplementedException();
  }
}
