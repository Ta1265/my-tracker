import { redirect } from 'next/navigation';
import { getSession } from '@/server/authSession';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getSession();
  if (session?.isAuthenticated) {
    redirect('/stats');
  } else {
    redirect('/login');
  }
}
