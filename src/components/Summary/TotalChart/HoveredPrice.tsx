'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/joy/Skeleton';
import TickerDisplay from '../../TickerDisplay';
import 'chartjs-adapter-moment';
import { useStatsTableContext } from '../../../context/StatsTableContext';

interface HoverPriceProps {
  profitLoss: number;
  portfolioSummaryIsPending: boolean;
  valueOfHoldings: number;
  roi: number;
  dataIndex: number | null;
  lowestPointIndex: number;
  highestPointIndex: number;
}

const timeFrameLabels: Record<string, string> = {
  h: 'Last Hour',
  d: 'Last Day',
  w: 'Last Week',
  m: 'Last Month',
  '3m': 'Last 3 Months',
  '6m': 'Last 6 Months',
  y: 'Last Year',
  all: 'All Time',
};

const getStatusLabel = (
  dataIndex: number | null,
  lowestPointIndex: number,
  highestPointIndex: number,
  selectedTimeFrame: string,
): string => {
  if (dataIndex !== lowestPointIndex && dataIndex !== highestPointIndex) return '';
  return `${dataIndex === lowestPointIndex ? 'Lowest' : 'Highest'} ${
    timeFrameLabels[selectedTimeFrame] || 'All Time'
  }`;
};

export const HoveredPrice: React.FC<HoverPriceProps> = ({
  profitLoss,
  portfolioSummaryIsPending,
  valueOfHoldings,
  roi,
  dataIndex,
  lowestPointIndex,
  highestPointIndex,
}) => {
  const { selectedTimeFrame } = useStatsTableContext();

  const color = profitLoss >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <>
      <Box display="flex" flexDirection="column" alignItems="flex-start" gap="4px">
        <Skeleton
          loading={portfolioSummaryIsPending}
          variant="rectangular"
          width="120px"
          height="32px"
        >
          <div
            className="text-lg md:text-2xl"
            style={{
              color,
              fontWeight: 700,
              fontFamily: 'Roboto Mono, monospace',
              letterSpacing: '-0.02em',
            }}
          >
            <TickerDisplay value={valueOfHoldings} format={'USD'} fracDigits={2} type={'animate'} />
          </div>
        </Skeleton>
        <Skeleton
          loading={portfolioSummaryIsPending}
          variant="rectangular"
          width="120px"
          height="20px"
        >
          <div
            className="text-[11px] md:text-[13px]"
            style={{
              color,
              fontFamily: 'Roboto Mono, monospace',
              opacity: 0.85,
            }}
          >
            <span className="flex flex-row items-center gap-1">
              <span>
                <TickerDisplay value={profitLoss || 0} format={'USD'} fracDigits={2} showArrow />
                {` (`}
                <TickerDisplay value={roi || 0} format={'PERCENTAGE'} fracDigits={2} />
                {')'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                {getStatusLabel(dataIndex, lowestPointIndex, highestPointIndex, selectedTimeFrame)}
              </span>
            </span>
          </div>
        </Skeleton>
      </Box>
    </>
  );
};
