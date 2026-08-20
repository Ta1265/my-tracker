import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { PriceHistoryResponseDto } from '../../exchange-rates/dto/price-history-response.dto';

// Every field below is required in the finished contract and documented as such via
// @ApiProperty, but also carries @IsOptional() so the permissive global pipe never
// 400s ahead of real handler logic - presence enforcement is business logic that lands
// with the real implementation, not something the stub's global pipe should take on.
export class SetPriceHistoryRequestDto {
  @ApiProperty({ example: 'Bitcoin' })
  @IsOptional()
  @IsString()
  coinName!: string;

  @ApiProperty({ example: '24h' })
  @IsOptional()
  @IsString()
  timeFrame!: string;

  @ApiProperty({ type: PriceHistoryResponseDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceHistoryResponseDto)
  priceHistoryResp!: PriceHistoryResponseDto;
}
