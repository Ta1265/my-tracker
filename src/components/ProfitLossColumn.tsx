import React, { useEffect, useState } from 'react';
import { useFetchPriceHistory } from '../_hooks/useFetchPriceHistory';
import Skeleton from '@mui/joy/Skeleton';
import { useQuery } from '@tanstack/react-query';
// import { Spinner } from 'flowbite-react';



interface PriceResp {
  prices: number[][];
  price_change: number;
  usd_price_change: number;
}

const ProfitLossColumn = ({
  coinName,
  selectedTimeFrame,
  currentPrice,
  holdings,
}: {
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
    <div className="text-center" style={{ color }}>
      <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        overlay={true}
        loading={isLoading}
      >
        <span className="">
          {arrow} {percentage}
        </span>
      </Skeleton>
    </div>
  );
};

export default ProfitLossColumn;
