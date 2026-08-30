'use client';

import type { LoginResponseDto } from '@/api/generated';
import { useAuthSession } from '@/api/generated';

export function useCurrentSession(): { data: LoginResponseDto | null | undefined } {
  // `retry: false` because a 401 here means "not logged in," not a transient failure.
  const nest = useAuthSession({ query: { retry: false } });

  return { data: nest.data };
}
