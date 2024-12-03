import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import { useQuery } from '@tanstack/react-query';


interface PriceResp {
  prices: number[][];
  price_change: number;
  usd_price_change: number;
}

const PercentChange = ({
  unit,
  coinName,
  selectedTimeFrame,
  currentPrice,
  holdings,
}: {
  unit: string;
  coinName: string;
  selectedTimeFrame: TimeFrame;
  currentPrice: string;
  holdings: string;
}) => {

  const { 
    data, 
    isPending,
    isError,
    error,
    isRefetching,
  } = useQuery<PriceResp>({
    queryKey: ['price', coinName, selectedTimeFrame],
    queryFn: async ({ signal }): Promise<PriceResp> => {
      const resp = await fetch(
        `https://price-api.crypto.com/price/v2/${selectedTimeFrame}/${coinName.toLowerCase()}`,
        { signal },
      );
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
    // refetchOnWindowFocus: 'always',
  });

  // const [price, setPrice] = useState<number | null>(null);

  // useEffect(() => {
  //   if (cbWs) {
  //     cbWs.addSubscription(unit, (data) => {
  //       setPrice(data.price)
  //     })
  //   }
  // }, []);

  const isLoading = isPending || isRefetching;

  const priceChange = data?.price_change;

  if (isError) {
    console.error(error);
    return <div className="text-center">Error</div>;
  }

  const color = priceChange && priceChange < 0 ? '#F0616D' : '#27AD75';
  const arrow = priceChange && priceChange > 0 ? '▲' : '▼';
  const percentage = priceChange && (priceChange * 100).toFixed(1) + '%';

  return (
    <div className="text-center" style={{ color, fontFamily: 'Roboto Mono, monospace' }}>
      <Skeleton variant="rectangular" width="100%" height="100%" overlay={true} loading={isLoading}>
        <span className="">
          {/* {price} */}
          {arrow} {percentage}
        </span>
      </Skeleton>
    </div>
  );
};

export default PercentChange;
