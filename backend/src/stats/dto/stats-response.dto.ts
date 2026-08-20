import { ApiProperty } from '@nestjs/swagger';

export class StatsResponseDto {
  @ApiProperty({ example: 'Bitcoin' })
  productName!: string;

  @ApiProperty({
    type: String,
    example: '$1,235',
    description: 'formatUSD-formatted average purchase price.',
  })
  avgPurchasePrice!: string;

  @ApiProperty({
    type: String,
    example: '$1,300',
    description: 'formatUSD-formatted average sell price.',
  })
  avgSellPrice!: string;

  @ApiProperty({
    type: String,
    example: '12.3400',
    description: 'Coin holdings, .toFixed(4)-formatted.',
  })
  holdings!: string;

  @ApiProperty({
    type: String,
    example: '$15,213',
    description: 'formatUSD-formatted value of current holdings.',
  })
  valueOfHoldings!: string;

  @ApiProperty({
    type: String,
    example: '$4,213',
    description: 'formatUSD-formatted profit/loss at the current price.',
  })
  profitLossAtCurrentPrice!: string;

  @ApiProperty({
    type: String,
    example: '4.2%',
    description: "Profit/loss percentage, .toFixed(1) + '%'-formatted.",
  })
  percentPL!: string;

  @ApiProperty({
    type: String,
    example: '$61,500',
    description: 'formatUSD-formatted current market price.',
  })
  currentPrice!: string;

  @ApiProperty({
    type: String,
    example: '$41,000',
    description: 'formatUSD-formatted break-even price.',
  })
  breakEvenPrice!: string;
}
