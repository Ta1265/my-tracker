import { ApiProperty } from '@nestjs/swagger';

// Raw TokenInfo row shape (schema.prisma), returned verbatim - no formatting.
export class TokenInfoResponseDto {
  @ApiProperty({ example: 1 })
  token_id!: number;

  @ApiProperty({ example: 'BTC' })
  symbol!: string;

  @ApiProperty({ example: 'bitcoin' })
  slug!: string;

  @ApiProperty({ example: 'Bitcoin' })
  name!: string;

  @ApiProperty({ example: 1 })
  rank!: number;
}
