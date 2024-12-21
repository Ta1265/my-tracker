import React, { createContext, useContext, useState } from 'react';
import { type TimeFrame } from '../components/product/TimeFrameSelect';
import { useQuery } from '@tanstack/react-query';
import { usePriceFeed } from './CoinbaseWsFeedContext';
import { type PriceHistoryResp } from '../../types/global';
import { useFetchCoinPriceHistory } from '../_hooks/useFetchCoinPriceHistory';

interface PriceHistoryContextProps {
  timeFrame: TimeFrame;
  setTimeFrame: React.Dispatch<React.SetStateAction<TimeFrame>>;
  hoveringChart: boolean;
  setHoveringChart: React.Dispatch<React.SetStateAction<boolean>>;
  hoverPrice: number | null;
  setHoverPrice: React.Dispatch<React.SetStateAction<number | null>>;
  priceData: PriceHistoryResp['prices'] | [[]];
  priceChange: number;
  startPrice: number;
  priceHistoryLoading: boolean;
  coinName: string;
  unit: string;
  priceFeed: number | null;
}

const PriceHistoryContext = createContext<PriceHistoryContextProps | undefined>(undefined);

export const PriceHistoryProvider: React.FC<{
  children: React.ReactNode;
  coinName: string;
  unit: string;
}> = ({ children, coinName, unit }) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('d');
  const [hoveringChart, setHoveringChart] = useState<boolean>(false);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const { price: priceFeed } = usePriceFeed(`${unit}-USD`);

  const { data, isLoading: priceHistoryLoading } = useFetchCoinPriceHistory(timeFrame, coinName);

  const { price_change, prices } = data || {};

  const priceData = React.useMemo(() => prices || [[]], [prices]) as PriceHistoryResp['prices'];
  const priceChange = React.useMemo(() => price_change || 0, [price_change]);
  const startPrice = React.useMemo(() => priceData[0][1] || 0, [priceData]);

  // const priceData = data?.prices || [[]];
  // const priceChange = data?.price_change || 0;
  // const startPrice = priceData[0][1] || 0;

  return (
    <PriceHistoryContext.Provider
      value={{
        timeFrame,
        setTimeFrame,
        hoveringChart,
        setHoveringChart,
        hoverPrice,
        setHoverPrice,
        priceData,
        priceChange,
        startPrice,
        priceHistoryLoading,
        coinName,
        unit,
        priceFeed,
      }}
    >
      {children}
    </PriceHistoryContext.Provider>
  );
};

export const usePriceHistory = (): PriceHistoryContextProps => {
  const context = useContext(PriceHistoryContext);
  if (!context) {
    throw new Error('usePriceChart must be used within a PriceChartProvider');
  }
  return context;
};