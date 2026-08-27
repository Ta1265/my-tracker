'use client';

import { useSession } from 'next-auth/react';
import type { LoginResponseDto } from '@/api/generated';
import { useAuthSession } from '@/api/generated';
import { getAuthTarget } from './target';

export function useCurrentSession(): { data: LoginResponseDto | null | undefined } {
  const nextAuth = useSession();
  // `enabled: false` keeps this from firing under the default target; `retry: false`
  // because a 401 here means "not logged in," not a transient failure.
  const nest = useAuthSession({
    query: { enabled: getAuthTarget() === 'nest', retry: false },
  });

  if (getAuthTarget() === 'nest') {
    return { data: nest.data };
  }

  const session = nextAuth.data;
  if (!session) {
    return { data: session };
  }
  // NextAuth's own Session type allows a null name; LoginResponseDto's AuthUserDto does not.
  return { data: { ...session, user: { ...session.user, name: session.user.name ?? '' } } };
}
