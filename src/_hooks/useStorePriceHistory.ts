'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Fetch Price History data for a given coin and timeframe from crypto.com and store it in our backend
 * We need to fetch this data on the frontend because crypto.com API has bot detection that blocks server-side requests
 */
const fetchAndStorePriceHistory = async (
  timeFrame: string,
  coinName: string,
  signal: AbortSignal,
) => {
  const cryptoComUrl = `https://price-api.crypto.com/price/v2/${timeFrame}/${coinName.toLowerCase()}`;

  const resp = await fetch(cryptoComUrl, { signal });

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch price history from crypto.com for ${coinName} ${timeFrame}. Status: ${resp.status}, ${resp.statusText}`,
    );
  }

  const backendUrl = `/api/price-history/set`;

  await fetch(backendUrl, {
    signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeFrame,
      coinName,
      priceHistoryResp: await resp.json(),
    }),
  });
};

/**
 * Get a list of which coins this user has, and which price history caches need to be updated for each
 */
const checkCoinPriceHistoryCache = async (signal: AbortSignal) => {
  const resp = await fetch(`/api/price-history/check`, { signal });

  if (!resp.ok) {
    throw new Error(
      `Failed to check price history cache. Status: ${resp.status}, ${resp.statusText}`,
    );
  }

  return resp.json() as Promise<{ coinName: string; timeFramesNeeded: string[] }[]>;
};

export const useStorePriceHistory = () => {
  return useQuery({
    queryKey: ['price-history-store'],
    queryFn: async ({ signal }) => {
      const cachesNeedingUpdate = await checkCoinPriceHistoryCache(signal);

     await Promise.all(cachesNeedingUpdate.flatMap(({ coinName, timeFramesNeeded }) =>
       timeFramesNeeded.map((timeFrame) =>
         fetchAndStorePriceHistory(timeFrame, coinName, signal),
       ),
     ));

      // await Promise.all(
      //   cachesNeedingUpdate.map(async ({ coinName, timeFramesNeeded }) => {
      //     await Promise.all(
      //       timeFramesNeeded.map((timeFrame) =>
      //         fetchAndStorePriceHistory(timeFrame, coinName, signal),
      //       ),
      //     );
      //   }),
      // );
    },
  });
};
