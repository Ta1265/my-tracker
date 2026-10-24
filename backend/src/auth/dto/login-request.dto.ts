import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// username/password are required here: letting either through as undefined crashes
// CredentialVerifierService instead of producing a clean 400/401 response.
export class LoginRequestDto {
  @ApiProperty({ example: 'jdoe' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @ApiProperty({ example: 'hunter2' })
  @IsNotEmpty()
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
