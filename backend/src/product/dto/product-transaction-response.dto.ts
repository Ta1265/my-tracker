import { ApiProperty } from '@nestjs/swagger';

class RealizedGainsDto {
  @ApiProperty({ example: 120.5 })
  total!: number;

  @ApiProperty({ example: 45.25 })
  short!: number;

  @ApiProperty({ example: 75.25 })
  long!: number;
}

export class ProductTransactionResponseDto {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: 'Bitcoin' })
  fullName!: string;

  @ApiProperty({ example: 'BTC-USD' })
  product!: string;

  @ApiProperty({ example: 'BUY' })
  side!: string;

  @ApiProperty({ example: 'BTC' })
  unit!: string;

  @ApiProperty({ example: 'Bought the dip' })
  notes!: string;

  @ApiProperty({
    type: String,
    example: '$1,234.56',
    description:
      'formatUSD-formatted price (route-local formatUSD copy, not the shared helper - no ' +
      'minimum-value threshold).',
  })
  price!: string;

  @ApiProperty({
    type: String,
    example: '$1,234.56',
    description:
      'formatUSD-formatted fee (route-local formatUSD copy, not the shared helper - no ' +
      'minimum-value threshold).',
  })
  fee!: string;

  @ApiProperty({
    type: String,
    example: '$1,234.56',
    description:
      'formatUSD-formatted total (route-local formatUSD copy, not the shared helper - no ' +
      'minimum-value threshold).',
  })
  total!: string;

  @ApiProperty({
    type: String,
    example: '$1,234.56',
    description:
      'formatUSD-formatted running cost basis (route-local formatUSD copy, not the shared ' +
      'helper - no minimum-value threshold).',
  })
  runningCostBasis!: string;

  @ApiProperty({
    type: String,
    example: '12.34',
    description: 'Coin quantity, returned via .toString(), not fixed-decimal formatted.',
  })
  size!: string;

  @ApiProperty({
    type: String,
    example: '12.3400',
    description: 'Running coin balance, .toFixed(4)-formatted.',
  })
  runningBalance!: string;

  @ApiProperty({
    type: String,
    example: '1/15/2026, 3:04:00 PM',
    description: '.toLocaleString()-formatted transaction date.',
  })
  date!: string;

  @ApiProperty({
    type: RealizedGainsDto,
    description: 'Realized gains from FIFO tax-lot matching, unformatted numbers.',
  })
  realizedGains!: RealizedGainsDto;
}
