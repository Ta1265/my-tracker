import React from 'react';
import Box from '@mui/material/Box';
import TickerDisplay from '../../TickerDisplay';
import 'chartjs-adapter-moment';
import { type TimeFrame } from '../../product/TimeFrameSelect';
import { DeltaSelectFilterMemo } from '../../stats-table/DeltaColumn';
import { timeFrameDisplay } from '../../SingleStat';
import { useStatsTableContext } from '../../../context/StatsTableContext';
import Skeleton from '@mui/joy/Skeleton';
import { useSummaryContext } from '../SummaryContext';

interface TimeFrameDeltaProps {}

export const TimeFrameDelta: React.FC<TimeFrameDeltaProps> = () => {
  const { selectedTimeFrame } = useStatsTableContext();

  const { timeFramePl, timeFramePercentPl, portfolioSummaryIsPending, timeFramePlLoading } =
    useSummaryContext();

  const loading = portfolioSummaryIsPending || timeFramePlLoading;

  return (
    <>
      <Box
        display="flex"
        flexDirection="column"
        width="50%"
        alignItems="flex-end"
        textAlign="right"
        className="justify-end"
      >
        <div className="flex max-h-[24px] min-w-[100px] flex-row items-center justify-end text-right text-xs font-bold capitalize md:max-h-[31.99px] md:text-base">
          <span className="text-right">P/L - {timeFrameDisplay[selectedTimeFrame]}</span>
          <DeltaSelectFilterMemo showAll />
        </div>

        <div
          className="flex flex-row justify-end text-right"
          style={{
            color: (timeFramePl || 0) > 0 ? '#27AD75' : '#F0616D',
          }}
        >
          <Skeleton loading={loading} variant="rectangular" width="100%" height="20.5px">
            <span className=" text-xs md:text-sm">
              <TickerDisplay
                value={timeFramePl || 0}
                format={'USD'}
                fracDigits={2}
                type={'animate'}
                showArrow
              />
            </span>
            <span className="text-right text-xs text-xs md:text-left md:text-sm">
              &nbsp;
              {'('}
              <TickerDisplay
                value={timeFramePercentPl || 0}
                format={'PERCENTAGE'}
                fracDigits={2}
                type={'animate'}
              />
              {')'}
            </span>
          </Skeleton>
        </div>
      </Box>
    </>
  );
};
