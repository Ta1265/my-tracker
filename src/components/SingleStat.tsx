import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import { useQuery } from '@tanstack/react-query';
import type { CoinSummaryResp } from '../../types/global';

const StatDisplay: React.FC<{
  label: string;
  isPending: boolean;
  content: React.ReactNode;
}> = ({ label, isPending, content }) => {
  return (
    <div className="w-[120px] px-2 py-2 text-center md:basis-1/5">
      <div className="flex-col">
        <div className="py-1 font-semibold underline decoration-dotted">{label}</div>
        <div className="font-light text-white">
          {isPending ? (
            <Skeleton
              width={window.innerWidth < 768 ? 120 : 150}
              height={40}
              loading={true}
              variant="rectangular"
            />
          ) : (
            content
          )}
        </div>
      </div>
    </div>
  );
};

const SingleStat: React.FC<{
  unit: String;
  priceChange: number | null;
  timeFrame: TimeFrame;
  timeFrameStartPrice: number;
}> = ({ unit, priceChange, timeFrame, timeFrameStartPrice }) => {
  const {
    isPending,
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

  if (isError) {
    console.error(error);
    return <div>Error Loading Portfolio Summary.</div>;
  }

  return (
    <div
      className="
        text-grey-700 
        flex 
        flex-wrap 
        text-center 
        text-xs 
        text-gray-500
        dark:text-gray-400
        md:justify-between
        md:text-base
        lg:text-lg
      "
    >
      <StatDisplay
        label="Holdings"
        isPending={isPending}
        content={
          <div className="text-center">
            <span>{coinSummary?.valueOfHoldings}</span>
            <br></br>
            <span className="">{coinSummary?.holdings}</span>
          </div>
        }
      />
      <StatDisplay
        label="AVG. Buy / Sell"
        isPending={isPending}
        content={
          <div className="grid-rows-2 text-center">
            <div>{coinSummary?.avgPurchasePrice}</div>
            <div>{coinSummary?.avgSellPrice}</div>
          </div>
        }
      />

      <StatDisplay
        label="Break Even"
        isPending={isPending}
        content={<div>{coinSummary?.breakEvenPrice}</div>}
      />

      <StatDisplay
        label="P/L All Time"
        isPending={isPending}
        content={
          <div
            className="flex-col"
            style={{
              color: coinSummary?.inGreen ? '#27AD75' : '##F0616D',
            }}
          >
            <span>{coinSummary?.profitLossAtCurrentPrice} </span>
            <br />
            <span className=""> {coinSummary?.percentPL}</span>
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
            {(() => {
              if (!timeFrameStartPrice) return '...';
              if (!coinSummary?.holdings || !coinSummary?.valueOfHoldings) return '...';
              const holdings = parseFloat(coinSummary?.holdings);
              const currentValue = parseFloat(coinSummary?.valueOfHoldings?.replace(/[$,]/g, ''));
              const prevValue = holdings * timeFrameStartPrice;
              const profitLoss = currentValue - prevValue;
              return profitLoss.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 2,
              });
            })()}
          </div>
        }
      />
    </div>
  );
};

export default SingleStat;
