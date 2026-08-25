'use client';

import { useQuery } from '@tanstack/react-query';
import { type TimeFrame } from '../components/product/TimeFrameSelect';
import { type PriceHistoryResponseDto } from '../../types/contracts';

export const useFetchCoinPriceHistory = (timeFrame: TimeFrame, coinName: string) => {
  return useQuery({
    queryKey: ['price-history', coinName.toLowerCase(), timeFrame.toLowerCase()],
    queryFn: async ({ signal }): Promise<PriceHistoryResponseDto> => {
      const resp = await fetch(
        `/api/exchange-rates/${timeFrame.toLowerCase()}/${coinName.toLowerCase()}`,
        { signal },
      );
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    // cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: 'always',
  });
};