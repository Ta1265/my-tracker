import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

// Every field below is required in the finished contract and documented as such via
// @ApiProperty, but also carries @IsOptional() so the permissive global pipe never
// 400s ahead of real handler logic - presence enforcement is business logic that lands
// with the real implementation, not something the stub's global pipe should take on.
export class TransactionAddRequestDto {
  @ApiProperty({ example: 1, description: 'TokenInfo.token_id of the coin being transacted.' })
  @IsOptional()
  @IsNumber()
  token_id!: number;

  @ApiProperty({
    example: 'BUY',
    description: "'BUY' or 'SELL', case-insensitive - normalized to upper case before validation.",
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['BUY', 'SELL'])
  side!: string;

  @ApiProperty({ example: 'BTC' })
  @IsOptional()
  @IsString()
  unit!: string;

  @ApiProperty({ example: '0.5', description: 'Coin quantity, as a decimal string.' })
  @IsOptional()
  @IsString()
  size!: string;

  @ApiProperty({ example: '42000.00', description: 'Price per coin, as a decimal string.' })
  @IsOptional()
  @IsString()
  price!: string;

  @ApiProperty({ example: '5.00', description: 'Transaction fee, as a decimal string.' })
  @IsOptional()
  @IsString()
  fee!: string;

  @ApiProperty({ example: '2025-01-15T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  date!: string;

  @ApiProperty({ example: 'Bought the dip', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
