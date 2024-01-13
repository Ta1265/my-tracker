import { useEffect, useState } from "react";

export const useFetchCurrentPrice = (
  unit: string | null,
  timeFrame: TimeFrame,
) => {
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
  }, [unit, timeFrame]);

  return { currentPrice, currentPriceIsLoading };
};
