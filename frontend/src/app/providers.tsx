'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@/api/http-client';
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
        defaultOptions: {
          queries: {
            // A 4xx is the server's final answer, so retrying only delays the UI
            // showing it. Everything else keeps the library's 3 attempts.
            retry: (failureCount, error) =>
              !(error instanceof HttpError && error.status >= 400 && error.status < 500) &&
              failureCount < 3,
          },
        },
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
