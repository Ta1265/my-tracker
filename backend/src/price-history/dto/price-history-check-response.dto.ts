import { ApiProperty } from '@nestjs/swagger';

export class PriceHistoryCheckResponseDto {
  @ApiProperty({ example: 'Bitcoin' })
  coinName!: string;

  @ApiProperty({
    type: [String],
    example: ['24h', '7d'],
    description:
      'TimeFrame values missing from Redis under ' +
      'time-frame-pl-{timeFrame}-coinName-{coinName} (both segments lowercased).',
  })
  timeFramesNeeded!: string[];
}
