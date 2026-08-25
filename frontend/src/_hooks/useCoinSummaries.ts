'use client';

import { useQuery, type QueryOptions } from '@tanstack/react-query';
import type { CoinSummaryResponseDto } from '../../types/contracts';

export const useCoinSummaries = () => {
  return useQuery({
    queryKey: ['summary', 'all-coins'],
    queryFn: async ({ signal }): Promise<CoinSummaryResponseDto[]> => {
      const resp = await fetch(`/api/summary/coins`, { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    }
  });
}