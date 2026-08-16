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
      <Box display="flex" flexDirection={'column'} width="100%" gap="12px">
        {showChart && (
          <div
            className="glass-card gradient-border w-full overflow-hidden"
            style={{ padding: '16px 8px 8px' }}
          >
            <TotalChartLayout />
          </div>
        )}

        {showBreakdown && (
          <div className="glass-card gradient-border w-full" style={{ padding: '0' }}>
            <div
              className="flex items-center gap-2 px-4 pb-2 pt-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent-emerald)',
                  flexShrink: 0,
                }}
              />
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                Breakdown
              </span>
            </div>
            <Box
              paddingY={2}
              paddingX={{
                xs: '2px',
                sm: '16px',
              }}
            >
              <BreakDown />
            </Box>
          </div>
        )}

        {showSummary && (
          <div className="glass-card gradient-border w-full" style={{ padding: '0' }}>
            <div
              className="flex items-center gap-2 px-4 pb-2 pt-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent-blue)',
                  flexShrink: 0,
                }}
              />
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                Portfolio Summary
              </span>
            </div>
            <div className="p-4">
              <TotalsSummary />
            </div>
          </div>
        )}
      </Box>
    </SummaryContextProvider>
  );
};

export default SummaryLayout;
