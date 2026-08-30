'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ReloadProvider } from '@/context/ReloadContext';
import { SnackbarProvider } from '@/context/SnackBarContext';
import { CoinbaseWsProvider } from '@/context/CoinbaseWsFeedContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { JoyThemeProvider } from '@/context/JoyThemeProvider';
import { BackgroundProvider } from '@/context/BackgroundContext';

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
      <ThemeProvider>
        <JoyThemeProvider>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <SnackbarProvider>
              <ReloadProvider id="reload-provider" onReload={refetchAllQueries}>
                <BackgroundProvider>
                  <CoinbaseWsProvider>{children}</CoinbaseWsProvider>
                </BackgroundProvider>
              </ReloadProvider>
            </SnackbarProvider>
          </LocalizationProvider>
        </JoyThemeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
