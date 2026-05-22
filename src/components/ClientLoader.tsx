'use client';

import React from 'react';
import { useStorePriceHistory } from '../_hooks/useStorePriceHistory';
import LoadingIndicator from './LoadingIndicator';

export default function ClientLoader({ children }: { children: React.ReactNode }) {
  const { isPending } = useStorePriceHistory();

  if (isPending) {
    return <LoadingIndicator />;
  }

  return <>{children}</>;
}