import { ApiProperty } from '@nestjs/swagger';

export class PriceHistoryResponseDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
    example: [[1700000000, 61000, 61500]],
    description:
      'Each entry is [unixTimestamp, openPrice, closePrice], returned verbatim and ' +
      "unformatted (getPriceHistoryForTimeFrame's return shape).",
  })
  prices!: [number, number, number][];

  @ApiProperty({ example: 0.025, description: 'Unformatted price change, as a decimal ratio.' })
  price_change!: number;

  @ApiProperty({ example: 1500, description: 'Unformatted price change, in USD.' })
  usd_price_change!: number;
}
