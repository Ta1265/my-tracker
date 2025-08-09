/* eslint-disable react/jsx-key */
import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import type { PortfolioSummary, TimeFrameTotalPlResp } from '../../../types/global';
import { useQuery } from '@tanstack/react-query';
import TickerDisplay from '../TickerDisplay';
import { DeltaSelectFilterMemo } from '../stats-table/DeltaColumn';
import { useStatsTableContext } from '../../context/StatsTableContext';
import { timeFrameDisplay } from '../SingleStat';
import { BreakDown } from './BreakDown';

const SummaryTable: React.FC<{}> = () => {
  const { selectedTimeFrame } = useStatsTableContext();

  const { isPending, isError, data, error } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async ({ signal }): Promise<PortfolioSummary> => {
      const resp = await fetch('/api/summary/portfolio', { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
    refetchInterval: 5000,
  });

  const { data: timeFramePlResp, isLoading: timeFramePlLoading} = useQuery({
    queryKey: ['time-frame-total-pl', selectedTimeFrame],
    queryFn: async ({ signal }): Promise<TimeFrameTotalPlResp> => {
      const resp = await fetch(`/api/time-frame-total-pl/${selectedTimeFrame}`, { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
    refetchInterval: 5000,
  });

  const currentTotalValue = timeFramePlResp?.currentTotalValue || 0;
  const pastTotalValue = timeFramePlResp?.pastTotalValue || 0;

  const timeFramePl = currentTotalValue - pastTotalValue;
  const timeFramePercentPl = timeFramePl / (pastTotalValue || 1) * 100;

  const [showBreakdown, setShowBreakdown] = React.useState(false);

  const inGreen = data?.inGreen || false;

  const isLoading = isPending;

  if (isError) {
    console.error(error);
    return <div>Error Loading Portfolio Summary.</div>;
  }

  if (showBreakdown && !isLoading) {
    return (
      <BreakDown
        data={data}
        showBreakdown={showBreakdown}
        setShowBreakdown={setShowBreakdown}
      />
    )
  }

  return (
    <div
      className="
        text-grey-700 
        justify-space-between
        text-base
        flex
        flex-row 
        flex-wrap
        justify-left
        md:justify-center
        text-xs
        md:text-base
      "
      // onClick={() => setShowBreakdown(!showBreakdown)}
    >
      <div className="flex flex-col px-3 min-w-[50px]" onClick={() => setShowBreakdown(!showBreakdown)}>
        <div className="flex-basis-1/3 py-1 min-w-[50px] text-center font-bold">Total Value </div>
        <Skeleton loading={isPending} variant="rectangular" overlay>
          <div
            className="text-left min-w-[50px]"
            style={{
              color: inGreen ? '#27AD75' : '#F0616D',
            }}
          >
            <TickerDisplay
              value={data?.valueOfHoldings || 0}
              format={'USD'}
              fracDigits={2}
              showArrow
              type={'animate'}
            />
          </div>
        </Skeleton>
      </div>
      <div
        className="flex-basis-2/3 flex flex-col px-3 min-w-[50px]"
        onClick={() => setShowBreakdown(!showBreakdown)}
      >
        <div className="py-1 text-left font-bold min-w-[50px]">Total P/L </div>
        <Skeleton loading={isPending} variant="rectangular" overlay>
          <div
            className="text-left min-w-[50px]"
            style={{
              color: inGreen ? '#27AD75' : '#F0616D',
            }}
          >
            <span className="flex flex-col md:flex-row">
              <span>
                <TickerDisplay
                  value={data?.totalPLatCurrentPrice || 0}
                  format={'USD'}
                  fracDigits={2}
                  type={'animate'}
                />
              </span>
              <span className="text-right text-xs md:text-base md:text-left">
                &nbsp;
                {`(`}
                <TickerDisplay
                  value={data?.roi || 0}
                  format={'PERCENTAGE'}
                  fracDigits={2}
                  type={'animate'}
                />
                {')'}
              </span>
            </span>
          </div>
        </Skeleton>
      </div>

      <div className="flex-basis-1/3 flex flex-col px-3 min-w-[50px]">
        <div className="flex py-1 min-w-[50px] max-h-[24px] md:max-h-[31.99px] flex-row items-center text-center font-bold capitalize">
          <span className="pl-4">
            P/L - {timeFrameDisplay[selectedTimeFrame]}
          </span>
            <DeltaSelectFilterMemo />
        </div>
        <Skeleton loading={timeFramePlLoading} variant="rectangular" overlay>
          <div
            className="flex pr-7 md:pr-1 flex-col md:flex-row text-right md:text-left"
            style={{
              color: timeFramePl > 0 ? '#27AD75' : '#F0616D',
            }}
          >
            <span>
              <TickerDisplay
                value={timeFramePl}
                format={'USD'}
                fracDigits={2}
                type={'animate'}
                showArrow
              />
            </span>
            <span className="text-right text-xs md:text-base md:text-left">
              &nbsp;
              {'('}
              <TickerDisplay
                value={timeFramePercentPl}
                format={'PERCENTAGE'}
                fracDigits={2}
                type={'animate'}
              />
              {')'}
            </span>
          </div>
        </Skeleton>
      </div>
    </div>
  );
};

export default SummaryTable; /* eslint-disable react/jsx-key */
