import { ApiProperty } from '@nestjs/swagger';

export class TimeFrameCoinsPlEntryDto {
  @ApiProperty({
    example: 1500,
    description: 'Unformatted profit/loss as of the time-frame start.',
  })
  pastPl!: number;

  @ApiProperty({ example: 1800, description: 'Unformatted current profit/loss.' })
  curPl!: number;

  @ApiProperty({ example: 42000, description: 'Unformatted coin price at the time-frame start.' })
  timeFrameStartPrice!: number;
}

// Object keyed by product name, not an array. Nest/Swagger cannot express an
// arbitrary-key map via @ApiProperty, so the controller documents this shape with a
// raw @ApiResponse schema (@ApiExtraModels + additionalProperties) rather than
// decorating this type directly - see time-frame-coins-pl.controller.ts.
export type TimeFrameCoinsPlResponseDto = Record<string, TimeFrameCoinsPlEntryDto>;
