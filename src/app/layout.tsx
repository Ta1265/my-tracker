import type { Metadata } from 'next';
import '@/styles/globals.css';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import Providers from './providers';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
  title: 'Portfolio Tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <AppRouterCacheProvider>
          <Providers>
            <Layout>{children}</Layout>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
