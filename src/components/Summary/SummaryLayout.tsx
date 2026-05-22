'use client';

/* eslint-disable react/jsx-key */
import React from 'react';
import { useStatsTableContext } from '../../context/StatsTableContext';
import { BreakDown } from './Breakdown/BreakDown';
import { TotalChartLayout } from './TotalChart/Layout';
import { Box } from '@mui/joy';
import { TotalsSummary } from './TotalsSummary';
import { SummaryContextProvider } from './SummaryContext';
import { useSummaryVisibility } from '../../context/SummaryVisibilityContext';

const SummaryLayout: React.FC<{}> = () => {
  const { selectedTimeFrame } = useStatsTableContext();
  const { showChart, showSummary, showBreakdown } = useSummaryVisibility();

  return (
    <SummaryContextProvider selectedTimeFrame={selectedTimeFrame}>
      <Box display="flex" flexDirection={'column'} width="100%" gap="16px">
        {showChart && (
          <div
            className="glass-card gradient-border w-full overflow-hidden"
            style={{ padding: '16px 8px 8px' }}
          >
            <TotalChartLayout />
          </div>
        )}

        {showBreakdown && (
          <div className="glass-card gradient-border w-full p-4">
            <BreakDown />
          </div>
        )}

        {showSummary && (
          <div className="glass-card gradient-border w-full p-4">
            <TotalsSummary />
          </div>
        )}


      </Box>
    </SummaryContextProvider>
  );
};

export default SummaryLayout;
