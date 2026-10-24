import { importJWK, jwtVerify } from 'jose';
import { SESSION_ALGORITHM, type SessionClaims } from '@portfolio/shared';
import type { LoginResponseDto } from '@/api/generated';

export async function verifySessionToken(
  token: string,
  publicKeyJwk: string,
): Promise<SessionClaims> {
  const key = await importJWK(JSON.parse(publicKeyJwk), SESSION_ALGORITHM);
  const { payload } = await jwtVerify(token, key, {
    algorithms: [SESSION_ALGORITHM],
  });
  return payload as unknown as SessionClaims;
}

// The frontend-side equivalent of the backend's toSessionResponse() (both whitelist
// the same claims into the same shape).
export function toSession(claims: SessionClaims): LoginResponseDto {
  return {
    isAuthenticated: true,
    user: {
      id: claims.sub,
      username: claims.username,
      email: claims.email,
      name: claims.name,
    },
  };
}
