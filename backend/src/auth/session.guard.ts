import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { SESSION_COOKIE_NAME } from '@portfolio/shared';
import { SessionService } from './session.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies[SESSION_COOKIE_NAME] as string | undefined;
    if (!token) {
      throw new UnauthorizedException();
    }

    request.user = this.sessionService.verify(token);
    return true;
  }
}
