import React from 'react';
import { useCoinSummaries } from '../_hooks/useCoinSummaries';
import { useStorePriceHistory } from '../_hooks/useStorePriceHistory';


export default function ClientLoader({ children }: { children: React.ReactNode }) {
  const { isPending: isStorePriceHistoryPending } = useStorePriceHistory();

  if (isStorePriceHistoryPending) {
    return "Loading...";
  }


  return <>{children}</>;
}