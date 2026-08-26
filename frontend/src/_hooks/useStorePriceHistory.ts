'use client';

import { useQuery } from '@tanstack/react-query';
import { priceHistoryCheck, setPriceHistory, type TimeFrame } from '../api/generated';

/**
 * Fetch Price History data for a given coin and timeframe from crypto.com and store it in our backend
 * We need to fetch this data on the frontend because crypto.com API has bot detection that blocks server-side requests
 */
const fetchAndStorePriceHistory = async (
  timeFrame: TimeFrame,
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

  await setPriceHistory(
    {
      timeFrame,
      coinName,
      priceHistoryResp: await resp.json(),
    },
    { signal },
  );
};

/**
 * Get a list of which coins this user has, and which price history caches need to be updated for each
 */
const checkCoinPriceHistoryCache = async (signal: AbortSignal) =>
  priceHistoryCheck({ signal });

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

      return null;

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
