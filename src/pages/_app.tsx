import '@/styles/globals.css';
import Head from 'next/head';
import type { AppProps } from 'next/app';
import Layout from '../components/Layout';
import { SessionProvider } from 'next-auth/react';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { createContext, useContext, useState } from 'react';
import { ReloadProvider } from '../context/ReloadContext';
import { SnackbarProvider } from '../context/SnackBarContext';

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <>
      <Head>
        <></>
        {/* <meta name="viewport" content="width=device-width"></meta>
        <meta name="viewport" content="viewport-fit=cover width=device-width" /> */}
      </Head>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <SnackbarProvider>
          <ReloadProvider id="reload-provider">
            <SessionProvider session={session}>
              <Layout>
                <Component {...pageProps} />
              </Layout>
            </SessionProvider>
          </ReloadProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </>
  );
}
