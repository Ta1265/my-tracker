import { Body, Controller, Get, HttpCode, NotImplementedException, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { SessionResponseDto } from './dto/session-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  @Post('login')
  @ApiOperation({
    description:
      'Verify credentials and issue a session cookie. Deliberately public - logging in ' +
      'cannot itself require a session.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Bad credentials.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Unauthorized' },
    },
  })
  // Verify credentials against the User table via bcrypt and issue an ES256-signed
  // session cookie.
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    throw new NotImplementedException();
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth()
  @ApiOperation({ description: "Clear the caller's session cookie." })
  @ApiResponse({ status: 204, description: 'Session cleared.' })
  // Clear the portfolio_session cookie.
  async logout(): Promise<void> {
    throw new NotImplementedException();
  }

  @Get('session')
  @ApiCookieAuth()
  @ApiOperation({ description: 'Return the whitelisted user shape for the current session.' })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiResponse({
    status: 401,
    description: 'No or expired session.',
    schema: {
      type: 'object',
      properties: { error: { type: 'string' } },
      example: { error: 'Unauthorized' },
    },
  })
  // Verify the session cookie and return the whitelisted user shape.
  async session(): Promise<SessionResponseDto> {
    throw new NotImplementedException();
  }
}
