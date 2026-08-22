import { importJWK, jwtVerify } from 'jose';
import { SESSION_ALGORITHM, type SessionClaims } from '@portfolio/shared';

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
