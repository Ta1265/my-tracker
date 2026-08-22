export const SESSION_ALGORITHM = 'ES256' as const;
export const SESSION_COOKIE_NAME = 'portfolio_session' as const;

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

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  name: string;
}

export interface Session {
  isAuthenticated: boolean;
  user: SessionUser;
}
