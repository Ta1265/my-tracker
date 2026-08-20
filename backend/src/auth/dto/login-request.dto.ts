import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

// Every field below is required in the finished contract but also carries
// @IsOptional() so the permissive global pipe never 400s ahead of real handler logic -
// presence enforcement is business logic that lands with the real implementation, not
// something the stub's global pipe should take on.
export class LoginRequestDto {
  @ApiProperty({ example: 'jdoe' })
  @IsOptional()
  @IsString()
  username!: string;

  @ApiProperty({ example: 'hunter2' })
  @IsOptional()
  @IsString()
  password!: string;

  @ApiProperty({
    example: false,
    description: 'Requests a 30-day session lifetime instead of the default 8h.',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe!: boolean;
}
