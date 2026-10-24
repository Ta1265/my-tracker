import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

// Also nested inside price-history/set's request body: whitelist: true strips any
// property with no class-validator decorator, even inside a @ValidateNested() object.
export class PriceHistoryResponseDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
    example: [[1700000000, 61000, 61500]],
    description:
      'Each entry is [unixTimestamp, openPrice, closePrice], returned verbatim and ' +
      "unformatted (getPriceHistoryForTimeFrame's return shape).",
  })
  @IsOptional()
  @IsArray()
  prices!: [number, number, number][];

  @ApiProperty({ example: 0.025, description: 'Unformatted price change, as a decimal ratio.' })
  @IsOptional()
  @IsNumber()
  price_change!: number;

  @ApiProperty({ example: 1500, description: 'Unformatted price change, in USD.' })
  @IsOptional()
  @IsNumber()
  usd_price_change!: number;
}
