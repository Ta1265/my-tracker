'use client';

import React, { createContext, useContext } from 'react';
import { usePortfolioSummary, useTimeFrameTotalPl } from '../../api/generated';
import type { PortfolioSummaryResponseDto, TimeFrame } from '../../api/generated';

interface SummaryContextProps {
  timeFramePl: number;
  timeFramePercentPl: number;
  portfolioSummary?: PortfolioSummaryResponseDto;
  portfolioSummaryIsPending: boolean;
  timeFramePlLoading: boolean;
}

export const SummaryContext = createContext<SummaryContextProps | undefined>(undefined);

export const SummaryContextProvider: React.FC<{
  selectedTimeFrame: TimeFrame;
  children: React.ReactNode;
}> = ({ selectedTimeFrame, children }) => {
  const { isPending, data: portfolioSummary } = usePortfolioSummary();

  const { data: timeFramePlResp, isLoading: timeFramePlLoading } =
    useTimeFrameTotalPl(selectedTimeFrame);

  const { timeFramePl, timeFramePercentPl } = React.useMemo(() => {
    let currentTotalValue = 0;
    let pastTotalValue = 0;
    let timeFramePl = 0;
    let timeFramePercentPl = 0;
    if (selectedTimeFrame === 'all') {
      currentTotalValue = portfolioSummary?.valueOfHoldings || 0;
      pastTotalValue = currentTotalValue - (portfolioSummary?.totalPLatCurrentPrice || 0);
      timeFramePl = portfolioSummary?.totalPLatCurrentPrice || 0;
      timeFramePercentPl = (timeFramePl / (pastTotalValue || 1)) * 100;
    } else {
      currentTotalValue = timeFramePlResp?.currentTotalValue || 0;
      pastTotalValue = timeFramePlResp?.pastTotalValue || 0;
      timeFramePl = currentTotalValue - pastTotalValue;
      timeFramePercentPl = (timeFramePl / (pastTotalValue || 1)) * 100;
    }
    return { timeFramePl, timeFramePercentPl };
  }, [selectedTimeFrame, portfolioSummary, timeFramePlResp]);

  const values = React.useMemo(
    () => ({
      timeFramePl,
      timeFramePercentPl,
      portfolioSummary,
      portfolioSummaryIsPending: isPending,
      timeFramePlLoading,
    }),
    [timeFramePl, timeFramePercentPl, portfolioSummary, isPending, timeFramePlLoading],
  );

  return <SummaryContext.Provider value={values}>{children}</SummaryContext.Provider>;
};

export const useSummaryContext = (): SummaryContextProps => {
  const context = useContext(SummaryContext);
  if (!context) {
    throw new Error('usePriceChart must be used within a StatsTableProvider');
  }
  return context;
};
