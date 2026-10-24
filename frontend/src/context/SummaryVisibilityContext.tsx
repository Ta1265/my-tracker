'use client';

import React, { createContext, useContext } from 'react';
import { useLocalStorage } from '../_hooks/useLocalStorage';

interface SummaryVisibilityContextValue {
  showChart: boolean;
  setShowChart: (val: boolean) => void;
  showSummary: boolean;
  setShowSummary: (val: boolean) => void;
  showBreakdown: boolean;
  setShowBreakdown: (val: boolean) => void;
}

const SummaryVisibilityContext = createContext<SummaryVisibilityContextValue | null>(null);

export const SummaryVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showChart, setShowChart] = useLocalStorage('showChart', true);
  const [showSummary, setShowSummary] = useLocalStorage('showSummary', false);
  const [showBreakdown, setShowBreakdown] = useLocalStorage('showBreakdown', false);

  return (
    <SummaryVisibilityContext.Provider value={{ showChart, setShowChart, showSummary, setShowSummary, showBreakdown, setShowBreakdown }}>
      {children}
    </SummaryVisibilityContext.Provider>
  );
};

export const useSummaryVisibility = () => {
  const ctx = useContext(SummaryVisibilityContext);
  if (!ctx) throw new Error('useSummaryVisibility must be used within SummaryVisibilityProvider');
  return ctx;
};
