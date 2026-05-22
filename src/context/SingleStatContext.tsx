'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export const STATS_LABEL_LIST = [
  'Coins Held',
  'Value',
  ' Total P/L',
  'P/L Timeframe',
  ' ROI',
  ' ROR',
  'Cost Basis',
  ' BreakEven Shares',
  ' BreakEven Price',
  'AVG. Buy',
  'AVG. Sell',
  'Net Contrib.',
  'Net Cash',
];

const LOCAL_STORAGE_KEY = 'selectedStats';

interface SingleStatContextValue {
  selectedStats: string[];
  toggleStat: (label: string) => void;
  statLabelList: string[];
}

const SingleStatContext = createContext<SingleStatContextValue | null>(null);

export const SingleStatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedStats, setSelectedStats] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return STATS_LABEL_LIST;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(selectedStats));
    }
  }, [selectedStats]);

  const toggleStat = (label: string) => {
    setSelectedStats((prev) =>
      prev.includes(label) ? prev.filter((k) => k !== label) : [...prev, label],
    );
  };

  return (
    <SingleStatContext.Provider value={{ selectedStats, toggleStat, statLabelList: STATS_LABEL_LIST }}>
      {children}
    </SingleStatContext.Provider>
  );
};

export const useSingleStat = () => {
  const ctx = useContext(SingleStatContext);
  if (!ctx) throw new Error('useSingleStat must be used within SingleStatProvider');
  return ctx;
};
