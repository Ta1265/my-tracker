import { ApiProperty } from '@nestjs/swagger';

export class SetPriceHistoryResponseDto {
  @ApiProperty({
    example: 'Price history updated for BTC (24h)',
    description: 'Interpolated per coinName/timeFrame, not a fixed string.',
  })
  message!: string;
}
