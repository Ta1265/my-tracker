import { ApiProperty } from '@nestjs/swagger';
import { TIME_FRAMES } from '../../common/time-frame/time-frames';

export class PriceHistoryCheckResponseDto {
  @ApiProperty({ example: 'Bitcoin' })
  coinName!: string;

  @ApiProperty({
    enum: TIME_FRAMES,
    enumName: 'TimeFrame',
    isArray: true,
    example: ['d', 'w'],
    description:
      'TimeFrame values missing from Redis under ' +
      'time-frame-pl-{timeFrame}-coinName-{coinName} (both segments lowercased).',
  })
  timeFramesNeeded!: string[];
}
