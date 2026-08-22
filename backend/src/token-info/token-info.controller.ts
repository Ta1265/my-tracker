import { Controller, Get, NotImplementedException, Param, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { TokenInfoResponseDto } from './dto/token-info-response.dto';
import { TokenInfoSyncResponseDto } from './dto/token-info-sync-response.dto';

@ApiTags('Token Info')
@Controller('token-info')
export class TokenInfoController {
  @Get(':userId')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiParam({ name: 'userId', example: '1' })
  @ApiOperation({
    description:
      "This route's name is misleading - it does not return token info, it triggers a " +
      'price-history sync (a database write) keyed by the given userId. Requires a ' +
      "session, with the sync scoped to the authenticated caller's own id - an " +
      'id/session mismatch is rejected rather than trusting the path param.',
  })
  @ApiOkResponse({ type: TokenInfoSyncResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Missing or falsy userId path param.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Missing userId param' },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No session.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Unauthorized' },
    },
  })
  // Triggers syncPriceHistoryToDbForUserId - does not return token info despite the
  // route name.
  async sync(
    @Param('userId') userId: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<TokenInfoSyncResponseDto> {
    throw new NotImplementedException();
  }

  @Get('search/:searchTerm')
  @ApiParam({ name: 'searchTerm', example: 'bit' })
  @ApiOperation({
    description:
      'Deliberately public: returns generic token metadata (symbol/name/slug lookup), not ' +
      'anything scoped to the caller. No auth today; stays public.',
  })
  @ApiOkResponse({ type: TokenInfoResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    description: 'Empty or missing search term.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Missing search query' },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'The TokenInfo query failed.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Internal Server Error' },
    },
  })
  // Will query TokenInfo (take: 10, OR on name/symbol startsWith searchTerm).
  async search(@Param('searchTerm') searchTerm: string): Promise<TokenInfoResponseDto[]> {
    throw new NotImplementedException();
  }
}
