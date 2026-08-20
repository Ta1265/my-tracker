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
    example: '12.3400',
    description: 'Coin quantity, .toFixed(4)-formatted.',
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
