import { useEffect, useState } from 'react';
import { useReload } from '../context/ReloadContext';

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
    fetch(`/api/exchange-rates/unit/${unit}`)
      .then((res) => res.json())
      .then((resp: string) => {
        setCurrentPrice(resp);
        setCurrentPriceIsLoading(false);
      });
  }, [unit, timeFrame, reload]);

  return { currentPrice, currentPriceIsLoading };
};
