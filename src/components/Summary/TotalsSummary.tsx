
import React from 'react';
import type { PortfolioSummary } from '../../../types/global';
import Skeleton from '@mui/joy/Skeleton';
import TickerDisplay from '../TickerDisplay';
import { DeltaSelectFilterMemo } from '../stats-table/DeltaColumn';
import { timeFrameDisplay } from '../SingleStat';
import { TimeFrame } from '../product/TimeFrameSelect';

interface TotalsSummaryProps {
  portfolioSummary?: PortfolioSummary | null;
  inGreen: boolean;
  timeFramePl: number;
  timeFramePercentPl: number;
  timeFramePlLoading: boolean;
  isPending: boolean;
  selectedTimeFrame: TimeFrame;
  roi: number;
  valueOfHoldings: number;
  totalPLatCurrentPrice: number;
}

export const TotalsSummary: React.FC<TotalsSummaryProps> = ({
  inGreen,
  timeFramePl,
  timeFramePercentPl,
  timeFramePlLoading,
  isPending,
  selectedTimeFrame,
  roi,
  valueOfHoldings,
  totalPLatCurrentPrice,
}) => {
  return (
    
        <div
          className="
        text-grey-700 
        justify-space-between
        justify-left
        flex
        flex-row 
        flex-wrap
        text-base
        text-xs
        md:justify-center
        md:text-base
      "
        >
          <div className="flex min-w-[50px] flex-col px-3">
            <div className="flex-basis-1/3 min-w-[50px] py-1 text-center font-bold">
              Total Value{' '}
            </div>
            <Skeleton loading={isPending} variant="rectangular" overlay>
              <div
                className="min-w-[50px] text-left"
                style={{
                  color: inGreen ? '#27AD75' : '#F0616D',
                }}
              >
                <TickerDisplay
                  value={valueOfHoldings}
                  format={'USD'}
                  fracDigits={2}
                  showArrow
                  type={'animate'}
                />
              </div>
            </Skeleton>
          </div>
          <div className="flex-basis-2/3 flex min-w-[50px] flex-col px-3">
            <div className="min-w-[50px] py-1 text-left font-bold">Total P/L </div>
            <Skeleton loading={isPending} variant="rectangular" overlay>
              <div
                className="min-w-[50px] text-left"
                style={{
                  color: inGreen ? '#27AD75' : '#F0616D',
                }}
              >
                <span className="flex flex-col md:flex-row">
                  <span>
                    <TickerDisplay
                      value={totalPLatCurrentPrice}
                      format={'USD'}
                      fracDigits={2}
                      type={'animate'}
                    />
                  </span>
                  <span className="text-right text-xs md:text-left md:text-base">
                    &nbsp;
                    {`(`}
                    <TickerDisplay
                      value={roi}
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

          <div className="flex-basis-1/3 flex min-w-[50px] flex-col px-3">
            <div className="flex max-h-[24px] min-w-[50px] flex-row items-center py-1 text-center font-bold capitalize md:max-h-[31.99px]">
              <span className="pl-4">P/L - {timeFrameDisplay[selectedTimeFrame]}</span>
              <DeltaSelectFilterMemo />
            </div>
            <Skeleton loading={timeFramePlLoading} variant="rectangular" overlay>
              <div
                className="flex flex-col pr-7 text-right md:flex-row md:pr-1 md:text-left"
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
                <span className="text-right text-xs md:text-left md:text-base">
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