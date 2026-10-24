import { ApiProperty } from '@nestjs/swagger';

export class TimeFrameTotalPlResponseDto {
  @ApiProperty({ example: 95000 })
  pastTotalValue!: number;

  @ApiProperty({ example: 102000 })
  currentTotalValue!: number;

  @ApiProperty({ example: 7000 })
  totalPastPl!: number;

  @ApiProperty({ example: 10000 })
  totalCurPl!: number;
}
