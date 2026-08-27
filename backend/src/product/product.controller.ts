import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SessionClaims } from '@portfolio/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { ProductTransactionResponseDto } from './dto/product-transaction-response.dto';
import { ProductService } from './product.service';

@ApiTags('Product')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get(':product')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiParam({ name: 'product', example: 'BTC' })
  @ApiOperation({
    operationId: 'productTransactions',
    description:
      "Return the caller's transaction history for a product, most recent first. An empty " +
      'product param returns [] rather than a 400.',
  })
  @ApiOkResponse({ type: ProductTransactionResponseDto, isArray: true })
  // Return the product's transaction history with running cost basis and realized gains,
  // formatted via formatUsdPrecise - do not reconcile with formatUSD here, the two are
  // deliberately kept separate (see formatUsdPrecise's own comment for why).
  async getByProduct(
    @Param('product') product: string,
    @CurrentUser() user: SessionClaims,
  ): Promise<ProductTransactionResponseDto[]> {
    return this.productService.getTransactionsForProduct(user.sub, product);
  }
}
