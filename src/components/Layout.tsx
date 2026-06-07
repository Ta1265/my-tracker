'use client';

import React from 'react';
import TopNav from './TopNav';
import ImageBackground from './ImageBackground';
import { SingleStatProvider } from '../context/SingleStatContext';
import { SummaryVisibilityProvider } from '../context/SummaryVisibilityContext';
import { useBackground } from '../context/BackgroundContext';

export default function Layout({ children }: { children: React.ReactNode }) {

  return (
    <SummaryVisibilityProvider>
      <SingleStatProvider>
        <div className="dark min-h-screen" style={{ background: 'var(--bg-primary)' }}>
          <ImageBackground />
          <main
            className="relative flex flex-col items-center"
            style={{ zIndex: 1, minHeight: '100vh' }}
          >
            <TopNav />
            <div className="flex w-full flex-col items-center px-2 pb-8">{children}</div>
          </main>
        </div>
      </SingleStatProvider>
    </SummaryVisibilityProvider>
  );
}
