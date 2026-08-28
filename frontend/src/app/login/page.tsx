import { redirect } from 'next/navigation';
import { getSession } from '@/auth/serverSession';
import LoginClient from './LoginClient';

export default async function LoginPage() {
  const session = await getSession();
  if (session?.isAuthenticated) {
    redirect('/stats');
  }
  return <LoginClient />;
}
