import { ApiProperty } from '@nestjs/swagger';

export class SetPriceHistoryResponseDto {
  @ApiProperty({
    example: 'Price history cached successfully: Bitcoin - d',
    description: 'Interpolated per coinName/timeFrame, not a fixed string.',
  })
  message!: string;
}
