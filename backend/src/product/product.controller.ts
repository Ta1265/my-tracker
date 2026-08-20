import { Controller, Get, NotImplementedException, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ProductTransactionResponseDto } from './dto/product-transaction-response.dto';

@ApiTags('Product')
@Controller('product')
export class ProductController {
  @Get(':product')
  @ApiCookieAuth()
  @ApiParam({ name: 'product', example: 'BTC' })
  @ApiOperation({
    description:
      "Return the caller's transaction history for a product, most recent first. An empty " +
      'product param returns [] rather than a 400.',
  })
  @ApiOkResponse({ type: ProductTransactionResponseDto, isArray: true })
  // Return the product's transaction history with running cost basis and realized gains,
  // formatted via the route-local formatUSD copy - do not reconcile with the shared
  // helper here, the two are deliberately kept separate.
  async getByProduct(@Param('product') product: string): Promise<ProductTransactionResponseDto[]> {
    throw new NotImplementedException();
  }
}
