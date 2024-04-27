import React, { useEffect, useState } from 'react';
import { useFetchPriceHistory } from '../_hooks/useFetchPriceHistory';
import { Spinner } from 'flowbite-react';

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
  const { priceChange, isLoading } = useFetchPriceHistory(
    coinName,
    selectedTimeFrame,
  );
  // const isLoading = true;

  return (
    <div
      className="text-center"
      style={{
        ...(priceChange && { color: priceChange < 0 ? '#F0616D' : '#27AD75' }),
      }}
    >
      <span className="">
        {' '}
        {(() => {
          if (!priceChange) return '...';
          return (
            (priceChange > 0 ? '▲' : '▼') +
            ' ' +
            (priceChange * 100).toFixed(1) +
            '%'
          );
        })()}
      </span>
    </div>
  );
};

export default ProfitLossColumn;
