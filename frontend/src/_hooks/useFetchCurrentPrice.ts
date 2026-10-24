'use client';

import { useEffect, useState } from 'react';
import { useReload } from '../context/ReloadContext';
import { type TimeFrame, exchangeRatesByUnit } from '../api/generated';

export const useFetchCurrentPrice = (
  unit: string | null,
  timeFrame: TimeFrame,
) => {
  const { reload } = useReload();
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const [currentPriceIsLoading, setCurrentPriceIsLoading] = useState(true);
  useEffect(() => {
    if (!unit) return;
    setCurrentPriceIsLoading(true);
    exchangeRatesByUnit(unit).then((resp) => {
      setCurrentPrice(resp);
      setCurrentPriceIsLoading(false);
    });
  }, [unit, timeFrame, reload]);

  return { currentPrice, currentPriceIsLoading };
};
