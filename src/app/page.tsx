import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/server/auth';

export default async function Home() {
  const session = await getServerAuthSession();
  if (session?.isAuthenticated) {
    redirect('/stats');
  } else {
    redirect('/login');
  }
}
