import { redirect } from 'next/navigation';
import { getServerSession } from '@/auth/serverSession';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession();
  if (session?.isAuthenticated) {
    redirect('/stats');
  } else {
    redirect('/login');
  }
}
