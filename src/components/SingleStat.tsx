import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import { useQuery } from '@tanstack/react-query';
import type { CoinSummaryResp } from '../../types/global';
import TickerDisplay from './TickerDisplay';
import { usePriceHistory } from '../context/PriceHistoryProvider';

export const timeFrameDisplay = {
  h: '1 Hour',
  d: '24 Hour',
  w: '7 Days',
  m: '30 Days',
  '3m': '3 Months',
  '6m': '6 Months',
  y: '1 Year',
  all: 'All Time',
};

const StatDisplay: React.FC<{
  label: string;
  isPending: boolean;
  content: React.ReactNode;
}> = ({ label, isPending, content }) => {
  return (
    <div className="px-2 py-1 min-w-[100px] md:min-w-[140px]">
      <div className="flex-col">
        <div className="py-1 text-center font-semibold underline decoration-dotted">{label}</div>
          <Skeleton
            width={140}
            height={24}
            loading={isPending}
            variant="rectangular"
          >
          <div
            className="text-white whitespace-nowrap text-sm md:text-base"
            style={{
              // fontFamily: 'Roboto Mono, monospace',
            }}
          >
            {content}
          </div>
          </Skeleton>
      </div>
    </div>
  );
};

const SingleStat: React.FC<{}> = () => {
  const {
    unit,
    priceChange,
    timeFrame,
    startPrice: timeFrameStartPrice,
    priceHistoryLoading: loading,
    priceFeed,
  } = usePriceHistory();

  const {
    isPending: summaryLoading,
    data: coinSummary,
    isError,
    error,
  } = useQuery({
    queryKey: [`summary`, unit],
    queryFn: async ({ signal }): Promise<CoinSummaryResp> => {
      const resp = await fetch(`/api/summary/${unit}`, { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }

      const data = await resp.json();

      if (!data?.length || data.length !== 1) {
        throw new Error('Unexpected response');
      }

      return data[0];
    },
  });

  const isPending = summaryLoading || loading;

  if (isError) {
    console.error(error);
    return <div>Error Loading Portfolio Summary.</div>;
  }

  const netCashHoldings = coinSummary?.netCashHoldings || 0;
  const price = priceFeed || 0;
  const holdings = coinSummary?.holdings || 0;
  const costBasis = coinSummary?.costBasis || 0;
  const netContributions = coinSummary?.netContributions || 0;

  const valueOfCurHoldings = price * holdings;

  const curPl = valueOfCurHoldings - costBasis;
  const roi = (curPl / netContributions) * 100;
  const ror = (curPl / costBasis) * 100;

  const breakEvenPrice = costBasis < 1 ? 0 : costBasis / holdings;

  return (
    <div
      className="
        text-grey-700 
        justify-space-evenly
        text-sm
        md:text-base
        flex
        flex-row 
        flex-wrap 
        text-center
        text-gray-500
        dark:text-gray-400
        justify-evenly
      "
    >
      <StatDisplay
        label="Coins Held"
        isPending={isPending}
        content={<span className="">{coinSummary?.holdings.toFixed(4)}</span>}
      />
      <StatDisplay
        label="Value"
        isPending={isPending}
        content={<TickerDisplay value={valueOfCurHoldings} format={'USD'} showArrow />}
      />
      <StatDisplay
        label=" Total P/L"
        isPending={isPending}
        content={
          <div
            className="flex-col"
            style={{
              color: curPl > 0 ? '#27AD75' : '##F0616D',
            }}
          >
            <TickerDisplay value={curPl} format={'USD'} showArrow />
          </div>
        }
      />
      <StatDisplay
        label={`P/L ${(() => {
          if (timeFrame === 'h') return '1 Hour';
          if (timeFrame === 'd') return '24 Hour';
          if (timeFrame === 'w') return '7 Days';
          if (timeFrame === 'm') return '30 Days';
          if (timeFrame === '3m') return '3 Months';
          if (timeFrame === '6m') return '6 Months';
          if (timeFrame === 'y') return '1 Year';
          if (timeFrame === 'all') return 'All Time';
        })()}`}
        isPending={
          isPending ||
          !priceChange ||
          !timeFrameStartPrice ||
          !coinSummary?.holdings ||
          !coinSummary?.valueOfHoldings
        }
        content={
          <div
            className="text-center"
            style={{
              color: !priceChange || priceChange < 0 ? '#F0616D' : '#27AD75',
            }}
          >
            <TickerDisplay
              value={(() => {
                const prevValue = holdings * (timeFrameStartPrice || 0);
                return valueOfCurHoldings - prevValue;
              })()}
              format={'USD'}
              showArrow
            />
          </div>
        }
      />

      <StatDisplay
        label=" ROI"
        isPending={isPending}
        content={
          <div style={{ color: roi > 0 ? '#27AD75' : '#F0616D' }}>
            <TickerDisplay value={roi} format={'PERCENTAGE'} showArrow/>
          </div>
        }
      />
      <StatDisplay
        label=" ROR"
        isPending={isPending}
        content={
          <div style={{ color: roi > 0 ? '#27AD75' : '#F0616D' }}>
            <TickerDisplay value={ror} format={'PERCENTAGE'} showArrow />
          </div>
        }
      />

      <StatDisplay
        label="Cost Basis"
        isPending={isPending}
        content={
          <div>
            {coinSummary?.costBasis.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}
          </div>
        }
      />
      <StatDisplay
        label="Break Even"
        isPending={isPending}
        content={
          <div>
            {breakEvenPrice.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}
          </div>
        }
      />
      <StatDisplay
        label="AVG. Buy"
        isPending={isPending}
        content={
          <div>
            {coinSummary?.avgPurchasePrice.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}
          </div>
        }
      />
      <StatDisplay
        label="AVG. Sell"
        isPending={isPending}
        content={
          <div>
            {coinSummary?.avgSellPrice.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}
          </div>
        }
      />
      <StatDisplay
        label="Net Contrib."
        isPending={isPending}
        content={
          <div>
            {coinSummary?.netContributions.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}
          </div>
        }
      />
      <StatDisplay
        label="Net cash"
        isPending={isPending}
        content={
          <div>
            {netCashHoldings.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}
          </div>
        }
      />
    </div>
  );
};

export default SingleStat;
