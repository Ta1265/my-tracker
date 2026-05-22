'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ReloadProvider } from '@/context/ReloadContext';
import { SnackbarProvider } from '@/context/SnackBarContext';
import { CoinbaseWsProvider } from '@/context/CoinbaseWsFeedContext';
import { ThemeProvider } from '@/context/ThemeContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: {} },
      }),
  );

  const refetchAllQueries = () => {
    queryClient.refetchQueries();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <SnackbarProvider>
          <ReloadProvider id="reload-provider" onReload={refetchAllQueries}>
            <SessionProvider>
              <ThemeProvider>
                <CoinbaseWsProvider>{children}</CoinbaseWsProvider>
              </ThemeProvider>
            </SessionProvider>
          </ReloadProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </QueryClientProvider>
  );
}
