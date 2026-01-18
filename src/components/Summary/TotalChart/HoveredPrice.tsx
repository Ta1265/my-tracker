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

  const color = profitLoss >= 0 ? '#27AD75' : '#F0616D';

  return (
    <>
      <Box display="flex" flexDirection="column" width="50%" alignItems="right" textAlign="right">
        <Skeleton
          loading={portfolioSummaryIsPending}
          variant="rectangular"
          width="50%"
          height="100%"
        >
          <div
            className="min-w-[50px] text-left font-bold md:text-2xl"
            style={{
              color,
            }}
          >
            <TickerDisplay value={valueOfHoldings} format={'USD'} fracDigits={2} type={'animate'} />
          </div>
        </Skeleton>
        <Skeleton
          loading={portfolioSummaryIsPending}
          variant="rectangular"
          width="50%"
          height="100%"
        >
          <div
            className="min-w-[50px] text-left text-xs"
            style={{
              color,
            }}
          >
            <span className="flex flex-col md:flex-row">
              <span>
                <TickerDisplay value={profitLoss || 0} format={'USD'} fracDigits={2} showArrow />
                &nbsp;
                {`(`}
                <TickerDisplay value={roi || 0} format={'PERCENTAGE'} fracDigits={2} />
                {')'}
              </span>
              <span className="text-left text-gray-700 dark:text-gray-400">
                &nbsp;
                {getStatusLabel(dataIndex, lowestPointIndex, highestPointIndex, selectedTimeFrame)}
              </span>
            </span>
          </div>
        </Skeleton>
      </Box>
    </>
  );
};
