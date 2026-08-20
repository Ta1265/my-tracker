import { ApiProperty } from '@nestjs/swagger';

export class CoinSummaryResponseDto {
  @ApiProperty({ example: 'Bitcoin' })
  productName!: string;

  @ApiProperty({ example: 'Bitcoin' })
  coinName!: string;

  @ApiProperty({ example: 41000 })
  avgPurchasePrice!: number;

  @ApiProperty({ example: 43000 })
  avgSellPrice!: number;

  @ApiProperty({ example: 1.2345 })
  holdings!: number;

  @ApiProperty({ example: 75213.5 })
  valueOfHoldings!: number;

  @ApiProperty({ example: 4213.2 })
  profitLossAtCurrentPrice!: number;

  @ApiProperty({ example: 4.2 })
  percentPL!: number;

  @ApiProperty({ example: 61500 })
  currentPrice!: number;

  @ApiProperty({ example: 41000 })
  breakEvenPrice!: number;

  @ApiProperty({
    example: true,
    description: 'Derived in the route (profitLossAtCurrentPrice > 0), not in SQL.',
  })
  inGreen!: boolean;

  @ApiProperty({ example: 50000 })
  totalBuyCost!: number;

  @ApiProperty({ example: 10000 })
  totalSellProfits!: number;

  @ApiProperty({
    example: 40000,
    description: 'Derived in the route (totalBuyCost - totalSellProfits), not in SQL.',
  })
  costBasis!: number;

  @ApiProperty({ example: 30000, description: 'Derived in the route from getBuySellTotalFiFo.' })
  netContributions!: number;

  @ApiProperty({ example: 5000, description: 'Derived in the route from getBuySellTotalFiFo.' })
  netCashHoldings!: number;
}
