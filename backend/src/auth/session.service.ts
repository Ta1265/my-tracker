import { randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SESSION_ALGORITHM, SessionClaims } from '@portfolio/shared';
import { CLOCK, Clock } from '../common/clock/clock';

const EIGHT_HOURS_SECONDS = 8 * 60 * 60;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

export interface IssuedSession {
  token: string;
  maxAgeSeconds: number;
  claims: SessionClaims;
}

export interface SessionUserInput {
  id: number;
  username: string;
  email: string;
  name: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  issue(user: SessionUserInput, rememberMe: boolean): IssuedSession {
    const maxAgeSeconds = rememberMe ? THIRTY_DAYS_SECONDS : EIGHT_HOURS_SECONDS;
    const iat = Math.floor(this.clock.now().getTime() / 1000);

    const claims: SessionClaims = {
      sub: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      rememberMe,
      jti: randomUUID(),
      iat,
      exp: iat + maxAgeSeconds,
    };

    // `noTimestamp: true` is deliberately not used here: jsonwebtoken's sign() (read at
    // node_modules/jsonwebtoken/sign.js) unconditionally `delete`s payload.iat when that
    // option is set, even when the caller already supplied one - it does not merely skip
    // auto-generation. Leaving the option off preserves our clock-derived `iat` because
    // sign() only falls back to Date.now() when payload.iat is falsy, which it never is
    // here.
    const token = this.jwtService.sign(claims, { algorithm: SESSION_ALGORITHM });

    return { token, maxAgeSeconds, claims };
  }

  verify(token: string): SessionClaims {
    try {
      return this.jwtService.verify<SessionClaims>(token, { algorithms: [SESSION_ALGORITHM] });
    } catch {
      throw new UnauthorizedException();
    }
  }
}
