
import React, { createContext, useContext, useState } from 'react';
import { type TimeFrame } from '../components/product/TimeFrameSelect';
import { useQuery } from '@tanstack/react-query';
import { type TimeFramePlByUnitResp } from '../../types/global';

interface StatsTableContextProps {
  selectedTimeFrame: TimeFrame;
  setSelectedTimeFrame: React.Dispatch<React.SetStateAction<TimeFrame>>;
  selectedPlType: 'roi' | 'ror';
  setSelectedPlType: React.Dispatch<React.SetStateAction<'roi' | 'ror'>>;

  timeFrameCoinsPl?: TimeFramePlByUnitResp;
  timeFrameCoinsPlIsLoading: boolean;
}

const StatsTableContext = createContext<StatsTableContextProps | undefined>(undefined);

export const StatsTableProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>('d');
  const [selectedPlType, setSelectedPlType] = useState<'roi' | 'ror'>('roi');

  const { data: timeFrameCoinsPl, isLoading: timeFrameCoinsPlIsLoading } = useQuery({
    queryKey: ['time-frame-coins-pl', selectedTimeFrame],
    queryFn: async ({ signal }): Promise<TimeFramePlByUnitResp> => {
      const resp = await fetch(`/api/time-frame-coins-pl/${selectedTimeFrame}`, { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  return (
    <StatsTableContext.Provider
      value={{
        timeFrameCoinsPl,
        timeFrameCoinsPlIsLoading,

        selectedTimeFrame,
        setSelectedTimeFrame,
        selectedPlType,
        setSelectedPlType,
      }}
    >
      {children}
    </StatsTableContext.Provider>
  );
};

export const useStatsTableContext = (): StatsTableContextProps => {
  const context = useContext(StatsTableContext);
  if (!context) {
    throw new Error('usePriceChart must be used within a StatsTableProvider');
  }
  return context;
};