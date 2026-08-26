import {
  Body,
  Controller,
  Delete,
  HttpCode,
  NotImplementedException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { TransactionAddRequestDto } from './dto/transaction-add-request.dto';

@ApiTags('Transactions')
@Controller('transaction')
export class TransactionsController {
  @Post('add')
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
  // Validate the body, look up the token, and write a Transaction row owned by the
  // caller's session, then return the bare string "Transaction added".
  async add(
    @Body() body: TransactionAddRequestDto,
    @CurrentUser() user: SessionClaims,
  ): Promise<string> {
    throw new NotImplementedException();
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
    description: 'The delete failed (e.g. no row with that id - there is no existence check).',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'An error occurred while deleting the transaction' },
    },
  })
  // Delete the transaction row by id - matches the existing behavior of not checking
  // whether the row exists first.
  async delete(@Param('id') id: string, @CurrentUser() user: SessionClaims): Promise<void> {
    throw new NotImplementedException();
  }
}
