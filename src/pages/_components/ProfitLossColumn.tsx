import React, { useEffect, useState } from 'react';
import { useFetchPriceHistory } from '../_hooks/useFetchPriceHistory';
import { Spinner } from 'flowbite-react';

export const ProfitLossColumn = ({
  coinName,
  selectedTimeFrame,
  currentPrice,
}: {
  coinName: string;
  selectedTimeFrame: TimeFrame;
  currentPrice: string;
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
