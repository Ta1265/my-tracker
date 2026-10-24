import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SESSION_COOKIE_NAME, SessionClaims } from '@portfolio/shared';
import { CredentialVerifierService } from './credential-verifier.service';
import { CurrentUser } from './current-user.decorator';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';
import { toSessionResponse } from './session-response.mapper';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { SessionResponseDto } from './dto/session-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentialVerifierService: CredentialVerifierService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'login',
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
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const user = await this.credentialVerifierService.verify(body.username, body.password);
    if (!user) {
      throw new UnauthorizedException();
    }

    const { token, maxAgeSeconds, claims } = this.sessionService.issue(
      { id: user.id, username: user.username, email: user.email, name: user.name ?? '' },
      body.rememberMe ?? false,
    );

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds * 1000,
    });

    return toSessionResponse(claims);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ operationId: 'logout', description: "Clear the caller's session cookie." })
  @ApiResponse({ status: 204, description: 'Session cleared.' })
  // Unconditional: invalidation only needs to clear the browser's cookie, not to require
  // a valid session to log out of, so this stays unguarded and without @ApiCookieAuth().
  async logout(@Res({ passthrough: true }) res: Response): Promise<void> {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  @Get('session')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'authSession',
    description: 'Return the whitelisted user shape for the current session.',
  })
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
  async session(@CurrentUser() claims: SessionClaims): Promise<SessionResponseDto> {
    return toSessionResponse(claims);
  }
}
