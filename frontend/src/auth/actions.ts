'use client';

import { signIn, signOut } from 'next-auth/react';
import { login, logout } from '@/api/generated';
import { getAuthTarget } from './target';

export async function seamSignIn(params: {
  username: string;
  password: string;
  rememberMe: boolean;
  callbackUrl: string;
}): Promise<{ error?: string; url?: string }> {
  if (getAuthTarget() === 'nest') {
    try {
      await login({
        username: params.username,
        password: params.password,
        rememberMe: params.rememberMe,
      });
      return { url: params.callbackUrl };
    } catch {
      return { error: 'Invalid username or password' };
    }
  }

  const result = await signIn('credentials', { ...params, redirect: false });
  return { error: result?.error ?? undefined, url: result?.url ?? undefined };
}

export async function seamSignOut(): Promise<void> {
  if (getAuthTarget() === 'nest') {
    await logout();
    // Hard-navigate so the app re-evaluates auth state from a clean load, mirroring
    // next-auth/react's own default post-sign-out navigation.
    window.location.href = '/';
    return;
  }

  await signOut();
}
