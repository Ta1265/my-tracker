'use client';

import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import TickerDisplay from '../TickerDisplay';
import { DeltaSelectFilterMemo } from '../stats-table/DeltaColumn';
import { timeFrameDisplay } from '../SingleStat';
import { useSummaryContext } from './SummaryContext';
import { useStatsTableContext } from '../../context/StatsTableContext';

export const TotalsSummary: React.FC<{}> = ({}) => {
  const { selectedTimeFrame } = useStatsTableContext();
  const {
    portfolioSummaryIsPending,
    portfolioSummary,
    timeFramePl,
    timeFramePercentPl,
    timeFramePlLoading,
  } = useSummaryContext();

  return (
    <div className="flex flex-row flex-wrap items-center justify-center gap-0 py-2">
      {/* Total Value */}
      <div className="flex flex-col items-center gap-1 px-6 py-1">
        <div
          className="flex items-center min-h-[20px] text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}
        >
          Total Value
        </div>
        <Skeleton loading={portfolioSummaryIsPending} variant="rectangular" overlay>
          <div
            className="text-xl font-semibold"
            style={{
              color: portfolioSummary?.inGreen ? 'var(--green)' : 'var(--red)',
              fontFamily: 'Roboto Mono, monospace',
            }}
          >
            <TickerDisplay
              value={portfolioSummary?.valueOfHoldings || 0}
              format={'USD'}
              fracDigits={2}
              showArrow
              type={'animate'}
            />
          </div>
        </Skeleton>
      </div>

      {/* Divider */}
      <div className="hidden md:block self-stretch w-px mx-1" style={{ background: 'var(--border-subtle)' }} />

      {/* Total P/L */}
      <div className="flex flex-col items-center gap-1 px-6 py-1">
        <div
          className="flex items-center min-h-[20px] text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}
        >
          Total P/L
        </div>
        <Skeleton loading={portfolioSummaryIsPending} variant="rectangular" overlay>
          <div
            className="text-xl font-semibold"
            style={{
              color: portfolioSummary?.inGreen ? 'var(--green)' : 'var(--red)',
              fontFamily: 'Roboto Mono, monospace',
            }}
          >
            <span className="flex flex-row items-baseline gap-1.5">
              <span>
                <TickerDisplay
                  value={portfolioSummary?.totalPLatCurrentPrice || 0}
                  format={'USD'}
                  fracDigits={2}
                  type={'animate'}
                />
              </span>
              <span
                className="text-sm"
                style={{ color: portfolioSummary?.inGreen ? 'var(--green)' : 'var(--red)', opacity: 0.7 }}
              >
                {`(`}
                <TickerDisplay
                  value={portfolioSummary?.roi || 0}
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

      {/* Divider */}
      <div className="hidden md:block self-stretch w-px mx-1" style={{ background: 'var(--border-subtle)' }} />

      {/* Time Frame P/L */}
      <div className="flex flex-col items-center gap-1 px-6 py-1">
        <div
          className="flex items-center min-h-[20px] gap-1 text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}
        >
          P/L — {timeFrameDisplay[selectedTimeFrame]}
          <span className="flex items-center leading-none"><DeltaSelectFilterMemo showAll={true} /></span>
        </div>
        <Skeleton loading={timeFramePlLoading} variant="rectangular" overlay>
          <div
            className="text-xl font-semibold"
            style={{
              color: timeFramePl > 0 ? 'var(--green)' : 'var(--red)',
              fontFamily: 'Roboto Mono, monospace',
            }}
          >
            <span className="flex flex-row items-baseline gap-1.5">
              <span>
                <TickerDisplay
                  value={timeFramePl}
                  format={'USD'}
                  fracDigits={2}
                  type={'animate'}
                  showArrow
                />
              </span>
              <span
                className="text-sm"
                style={{ color: timeFramePl > 0 ? 'var(--green)' : 'var(--red)', opacity: 0.7 }}
              >
                {'('}
                <TickerDisplay
                  value={timeFramePercentPl}
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
    </div>
  );
};

