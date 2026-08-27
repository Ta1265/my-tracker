import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
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
import { TokenInfoService } from './token-info.service';

@ApiTags('Token Info')
@Controller('token-info')
export class TokenInfoController {
  constructor(private readonly tokenInfoService: TokenInfoService) {}

  @Get(':userId')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiParam({ name: 'userId', example: '1' })
  @ApiOperation({
    operationId: 'tokenInfoSync',
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
  @ApiResponse({
    status: 403,
    description: "The userId path param does not match the caller's own session.",
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Forbidden' },
    },
  })
  // Triggers syncPriceHistoryToDbForUserId - does not return token info despite the
  // route name.
  async sync(
    @Param('userId') userId: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<TokenInfoSyncResponseDto> {
    const parsedUserId = userId ? parseInt(userId, 10) : NaN;
    if (!parsedUserId) {
      throw new BadRequestException('Missing userId param');
    }
    if (parsedUserId !== user.sub) {
      throw new ForbiddenException();
    }

    await this.tokenInfoService.syncPriceHistoryForUser(parsedUserId);
    return { success: true, userId: parsedUserId };
  }

  @Get('search/:searchTerm')
  @ApiParam({ name: 'searchTerm', example: 'bit' })
  @ApiOperation({
    operationId: 'tokenInfoSearch',
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
  async search(@Param('searchTerm') searchTerm: string): Promise<TokenInfoResponseDto[]> {
    if (!searchTerm) {
      throw new BadRequestException('Missing search query');
    }

    // The entity's columns are nullable (schema-safety), the DTO's are not (they match
    // the data every row actually has) - the cast bridges that, not a shape change.
    return (await this.tokenInfoService.searchTokenInfo(searchTerm)) as TokenInfoResponseDto[];
  }
}
