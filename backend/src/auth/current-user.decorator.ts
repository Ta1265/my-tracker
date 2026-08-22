import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SessionClaims } from '@portfolio/shared';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionClaims => {
    return ctx.switchToHttp().getRequest<Request>().user as SessionClaims;
  },
);
