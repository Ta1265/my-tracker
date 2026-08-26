export const SESSION_ALGORITHM = 'ES256' as const;
export const SESSION_COOKIE_NAME = 'portfolio_session' as const;

// The JWT payload and the cookie/algorithm names have no HTTP response to generate
// from, so they can't move to frontend/src/api/generated.ts the way the old
// response-shaped exports did.
export interface SessionClaims {
  sub: number;
  username: string;
  email: string;
  name: string;
  rememberMe: boolean;
  jti: string;
  iat: number;
  exp: number;
}
