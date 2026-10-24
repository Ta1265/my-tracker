import { Body, Controller, Delete, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { TransactionAddRequestDto } from './dto/transaction-add-request.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@Controller('transaction')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('add')
  @HttpCode(200)
  // Nest's default reply for a returned string uses Express's res.send(), which sends
  // text/html and drops the JSON quoting; the old route returns a JSON-encoded string,
  // so the content type is pinned here and the body is pre-serialized to match.
  @Header('Content-Type', 'application/json')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'addTransaction',
    description: "Record a transaction owned by the caller's session.",
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction recorded.',
    schema: { type: 'string', example: 'Transaction added' },
  })
  @ApiResponse({
    status: 400,
    description: 'Missing required fields, an invalid side, or an unknown token_id.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Missing required fields' },
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
  async add(
    @Body() body: TransactionAddRequestDto,
    @CurrentUser() user: SessionClaims,
  ): Promise<string> {
    await this.transactionsService.addTransaction(user.sub, body);
    return JSON.stringify('Transaction added');
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiParam({ name: 'id', example: '1', description: "The transaction's numeric id, as a string." })
  @ApiOperation({
    operationId: 'deleteTransaction',
    description: "Delete the caller's transaction by id.",
  })
  @ApiResponse({ status: 204, description: 'Transaction deleted.' })
  @ApiResponse({
    status: 400,
    description: 'Missing id parameter.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Missing id parameter' },
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
    status: 500,
    description:
      'The delete failed: no row with that id, or the id belongs to another ' +
      'user - the two are indistinguishable to the caller.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'An error occurred while deleting the transaction' },
    },
  })
  async delete(@Param('id') id: string, @CurrentUser() user: SessionClaims): Promise<void> {
    await this.transactionsService.deleteTransaction(parseInt(id, 10), user.sub);
  }
}
