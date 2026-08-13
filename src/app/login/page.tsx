import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/server/auth';
import LoginClient from './LoginClient';

export default async function LoginPage() {
  const session = await getServerAuthSession();
  if (session?.isAuthenticated) {
    redirect('/stats');
  }
  return <LoginClient />;
}
