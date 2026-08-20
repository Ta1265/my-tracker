import { ApiProperty } from '@nestjs/swagger';

// The whitelisted authenticated-user shape. Reused as-is by SessionResponseDto since
// both endpoints deliberately return the same shape.
export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'jdoe' })
  username!: string;

  @ApiProperty({ example: 'jdoe@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  name!: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: true })
  isAuthenticated!: true;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
