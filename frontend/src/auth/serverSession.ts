import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@portfolio/shared';
import type { LoginResponseDto } from '@/api/generated';
import { getAuthTarget } from '@/auth/target';
import { getServerAuthSession } from '@/server/auth';
import { toSession, verifySessionToken } from './session';

export async function getSession(): Promise<LoginResponseDto | null> {
  if (getAuthTarget() === 'nest') {
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

  const session = await getServerAuthSession();
  if (!session) {
    return null;
  }
  // NextAuth's own Session type allows a null name; LoginResponseDto's AuthUserDto does not.
  return { ...session, user: { ...session.user, name: session.user.name ?? '' } };
}
