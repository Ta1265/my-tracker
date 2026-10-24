'use client';


import React, { createContext, useContext, useState } from 'react';
import { useTimeFrameCoinsPl, type TimeFrameCoinsPl200, type TimeFrame } from '../api/generated';
import { useLocalStorage } from '../_hooks/useLocalStorage';

interface StatsTableContextProps {
  selectedTimeFrame: TimeFrame;
  setSelectedTimeFrame: React.Dispatch<React.SetStateAction<TimeFrame>>;
  selectedPlType: 'roi' | 'ror';
  setSelectedPlType: React.Dispatch<React.SetStateAction<'roi' | 'ror'>>;

  timeFrameCoinsPl?: TimeFrameCoinsPl200;
  timeFrameCoinsPlIsLoading: boolean;

  columns: [string, boolean][];
  toggleColumn: (id: string) => void;
  moveColumn: (id: string) => void;
}

const DEFAULT_COLUMN_MAP: [string, boolean][] = [
  ['coin', true],
  ['holdings', true],
  ['costBasis', true],
  ['currentPrice', true],
  ['delta', true],
  ['total', true],
];

const StatsTableContext = createContext<StatsTableContextProps | undefined>(undefined);

export const StatsTableProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>('d');
  const [selectedPlType, setSelectedPlType] = useState<'roi' | 'ror'>('roi');
  const [columns, setColumns] = useLocalStorage<[string, boolean][]>(
    'stats-table-columns',
    DEFAULT_COLUMN_MAP,
  );

  const moveColumn = React.useCallback((id: string) => {
    const next = [...columns];
    const idx = next.findIndex(([k]) => k === id);
    if (idx <= 0) return;
    [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
    setColumns(next);
  }, [columns, setColumns]);

  const toggleColumn = React.useCallback((id: string) => {
    setColumns(columns.map(([k, v]): [string, boolean] => k === id ? [k, !v] : [k, v]));
  }, [columns, setColumns]);

  const { data: timeFrameCoinsPl, isLoading: timeFrameCoinsPlIsLoading } = useTimeFrameCoinsPl(
    selectedTimeFrame,
    {
      query: {
        staleTime: 30 * 60 * 1000, // 30 minutes
      },
    },
  );

  const values = React.useMemo(
    (): StatsTableContextProps => ({
      timeFrameCoinsPl,
      timeFrameCoinsPlIsLoading,
      selectedTimeFrame,
      setSelectedTimeFrame,
      selectedPlType,
      setSelectedPlType,
      columns,
      toggleColumn,
      moveColumn,
    }),
    [
      timeFrameCoinsPl,
      timeFrameCoinsPlIsLoading,
      selectedTimeFrame,
      selectedPlType,
      columns,
      toggleColumn,
      moveColumn,
    ],
  );

  return (
    <StatsTableContext.Provider
      value={values}
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