'use client';

import { useCoinPriceHistory, type TimeFrame } from '../api/generated';

export const useFetchCoinPriceHistory = (timeFrame: TimeFrame, coinName: string) => {
  return useCoinPriceHistory(timeFrame, coinName, {
    query: {
      queryKey: ['price-history', coinName.toLowerCase(), timeFrame.toLowerCase()],
      staleTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: 'always',
    },
  });
};
