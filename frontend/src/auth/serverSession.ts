import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@portfolio/shared';
import type { LoginResponseDto } from '@/api/generated';
import { toSession, verifySessionToken } from './session';

export async function getServerSession(): Promise<LoginResponseDto | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  try {
    const claims = await verifySessionToken(token, process.env.SESSION_PUBLIC_KEY_JWK!);
    return toSession(claims);
  } catch {
    return null;
  }
}
