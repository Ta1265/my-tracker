import { ApiProperty } from '@nestjs/swagger';

// Named for what the endpoint actually does (triggers a price-history sync), not for
// the misleading `token-info` route name it lives under - see 2.1's landmine.
export class TokenInfoSyncResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 1 })
  userId!: number;
}
