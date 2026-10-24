import { ApiProperty } from '@nestjs/swagger';

class NetCashFlowRowDto {
  @ApiProperty({ example: 1700000000000, description: 'Epoch ms.' })
  date!: number;

  @ApiProperty({ example: 95000 })
  valueOfHoldings!: number;

  @ApiProperty({ example: 15000 })
  profitLoss!: number;

  @ApiProperty({ example: 0.1875 })
  roi!: number;
}

export class ProfitLossChartResponseDto {
  @ApiProperty({
    type: NetCashFlowRowDto,
    isArray: true,
    description:
      'Empty array for a user with no transaction history - the route falls back to { ' +
      'netRows: [], lowestPointIndex: 0, highestPointIndex: 0 }, not an error.',
  })
  netRows!: NetCashFlowRowDto[];

  @ApiProperty({ example: 3 })
  lowestPointIndex!: number;

  @ApiProperty({ example: 12 })
  highestPointIndex!: number;
}
