import { redirect } from 'next/navigation';
import { getServerSession } from '@/auth/serverSession';
import LoginClient from './LoginClient';

export default async function LoginPage() {
  const session = await getServerSession();
  if (session?.isAuthenticated) {
    redirect('/stats');
  }
  return <LoginClient />;
}
