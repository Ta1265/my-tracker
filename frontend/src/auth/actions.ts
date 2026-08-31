'use client';

import { login, logout } from '@/api/generated';

export async function seamSignIn(params: {
  username: string;
  password: string;
  rememberMe: boolean;
  callbackUrl: string;
}): Promise<{ error?: string; url?: string }> {
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

export async function seamSignOut(): Promise<void> {
  await logout();
  // Hard-navigate so the app re-evaluates auth state from a clean load.
  window.location.href = '/';
}
