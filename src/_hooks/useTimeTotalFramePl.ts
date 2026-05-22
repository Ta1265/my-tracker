'use client';


import { useQuery } from '@tanstack/react-query';
import { type TimeFrame } from '../../types/global';
import type { TimeFrameTotalPlResp } from '../../types/global';

export const useTimeTotalFramePl = (selectedTimeFrame: TimeFrame) => {
  const resp = useQuery({
    queryKey: ['time-frame-total-pl', selectedTimeFrame],
    queryFn: async ({ signal }): Promise<TimeFrameTotalPlResp> => {
      const resp = await fetch(`/api/time-frame-total-pl/${selectedTimeFrame}`, { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
    // refetchInterval: 5000,
  });
  
  return resp;
}