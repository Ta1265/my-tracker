import { ApiProperty } from '@nestjs/swagger';

export class PortfolioSummaryResponseDto {
  @ApiProperty({ example: 100000 })
  purchases!: number;

  @ApiProperty({ example: 20000 })
  sales!: number;

  @ApiProperty({ example: 80000 })
  costBasis!: number;

  @ApiProperty({ example: 95000 })
  valueOfHoldings!: number;

  @ApiProperty({ example: 15000 })
  totalPLatCurrentPrice!: number;

  @ApiProperty({ example: 10000 })
  netCashHoldings!: number;

  @ApiProperty({ example: 80000 })
  netContributions!: number;

  @ApiProperty({ example: 105000 })
  accountValue!: number;

  @ApiProperty({ example: 5000 })
  realizedReturn!: number;

  @ApiProperty({
    example: 0.1875,
    nullable: true,
    description: 'NaN when netContributions is 0 (division by zero), which serializes to null.',
  })
  roi!: number | null;

  @ApiProperty({ example: true, description: 'Derived in the route (profitLoss > 0), not in SQL.' })
  inGreen!: boolean;
}
