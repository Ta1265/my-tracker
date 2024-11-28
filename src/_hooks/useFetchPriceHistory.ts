import { useEffect, useState } from 'react';
import { useReload } from '../context/ReloadContext';


export const useFetchPriceHistory = (
  coinName: string | null,
  timeFrame: TimeFrame,
) => {
  const { reload } = useReload();
  const [priceData, setPriceData] = useState<Array<any>>([[]]);
  const [priceChange, setPriceChange] = useState<number>(0);

  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    if (!coinName) return;
    setLoading(true);
    setPriceData([[]]);
    fetch(
      `https://price-api.crypto.com/price/v2/${timeFrame}/${coinName.toLowerCase()}`,
    )
      .then((res) => res?.json())
      .then((resp: any) => {
        setPriceData(resp.prices);
        setPriceChange(resp.price_change);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setPriceData([[]]);
        setPriceChange(0);
        setLoading(false);
      });
  }, [coinName, timeFrame, reload]);

  return { priceData, priceChange, isLoading };
};
