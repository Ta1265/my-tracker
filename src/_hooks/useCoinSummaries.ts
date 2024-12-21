import { useQuery, type QueryOptions } from '@tanstack/react-query';
import { type CoinSummaryResp } from '../../types/global';

export const useCoinSummaries = () => {
  return useQuery({
    queryKey: ['summary', 'all-coins'],
    queryFn: async ({ signal }): Promise<CoinSummaryResp[]> => {
      const resp = await fetch(`/api/summary/coins`, { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    }
  });
}