// export default function Home() {
//   return <div>Home</div>;
// }
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Component() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'authenticated') {
      router.push('/stats');
    } else {
      signIn('username');
    }
  }, [status, router]);

  return <></>;
}
