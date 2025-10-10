import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import { useQuery } from '@tanstack/react-query';
import type { CoinSummaryResp } from '../../types/global';
import TickerDisplay from './TickerDisplay';
import { usePriceHistory } from '../context/PriceHistoryProvider';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import { Checkbox } from 'flowbite-react';

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

const STATS_LABEL_LIST = [
  'Coins Held',
  'Value',
  ' Total P/L',
  'P/L Timeframe',
  ' ROI',
  ' ROR',
  'Cost Basis',
  ' BreakEven Shares',
  ' BreakEven Price',
  'AVG. Buy',
  'AVG. Sell',
  'Net Contrib.',
  'Net Cash',
];

const StatDisplay: React.FC<{
  label: string;
  isPending: boolean;
  content: React.ReactNode;
  selectedStats: string[];
}> = ({ label, isPending, content, selectedStats }) => {
  let check = label
  if (label.startsWith('P/L') && selectedStats.includes('P/L Timeframe')) {
    check = 'P/L Timeframe'
  } 
  if (!selectedStats?.includes(check)) {
    return null;
  }
  return (
    <div className="px-2 py-1 min-w-[100px] md:min-w-[135px]">
      <div className="flex-col">
        <div className="py-1 text-center font-semibold underline decoration-dotted">{label}</div>
          <Skeleton
            width={100}
            height={24}
            loading={isPending}
            variant="rectangular"
          >
          <div
            className="text-white whitespace-nowrap text-sm md:text-base"
            style={{
              fontFamily: 'Roboto Mono, monospace',
            }}
          >
            {content}
          </div>
          </Skeleton>
      </div>
    </div>
  );
};


const LOCAL_STORAGE_KEY = 'selectedStats';

const SingleStat: React.FC<{}> = () => {
  const [selectedStats, setSelectedStats] = React.useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return STATS_LABEL_LIST;
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(selectedStats));
    }
  }, [selectedStats]);

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
   <>
   <div className="w-full inline-block">
      <Select
        multiple
        value={[]}
        className="
            hover:border-grey-700
            font-b
            ml-auto
            bg-gray-700
            px-1
            py-2
            text-xl
            text-white
            dark:bg-black sm:text-xl
            w-50px
            float-right
          "
        sx={{
          border: 0,
          fontSize: {
            sm: '20px',
            md: '20px',
            lg: '24px',
          },
        }}
      >
        {STATS_LABEL_LIST.map((label) => (
          <Option
            key={label}
            value={label}
            onClick={() => {
              if (selectedStats.includes(label)) {
                setSelectedStats(selectedStats.filter((k) => k !== label));
              } else {
                setSelectedStats([...selectedStats, label]);
              }
            }}
          >
            <Checkbox checked={selectedStats.includes(label)} />
            {label}
          </Option>
        ))}
      </Select>
    </div>
    <div
      className="
        text-grey-700 
        justify-space-evenly
        flex
        flex-row
        flex-wrap
        justify-evenly 
        text-center 
        text-sm
        text-gray-500
        dark:text-gray-400
        md:text-base
      "
    >
      <StatDisplay
        selectedStats={selectedStats}
        label="Coins Held"
        isPending={isPending}
        content={
          <span className="">
            {coinSummary?.holdings.toFixed(4)}
            {unit}
          </span>
        }
      />
      <StatDisplay
        selectedStats={selectedStats}
        label="Value"
        isPending={isPending}
        content={<TickerDisplay value={valueOfCurHoldings} format={'USD'} showArrow />}
      />
      <StatDisplay
        selectedStats={selectedStats}
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
        selectedStats={selectedStats}
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
        selectedStats={selectedStats}
        label=" ROI"
        isPending={isPending}
        content={
          <div style={{ color: roi > 0 ? '#27AD75' : '#F0616D' }}>
            <TickerDisplay value={roi} format={'PERCENTAGE'} showArrow />
          </div>
        }
      />
      <StatDisplay
        selectedStats={selectedStats}
        label=" ROR"
        isPending={isPending}
        content={
          <div style={{ color: roi > 0 ? '#27AD75' : '#F0616D' }}>
            <TickerDisplay value={ror} format={'PERCENTAGE'} showArrow />
          </div>
        }
      />
      <StatDisplay
        selectedStats={selectedStats}
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
        selectedStats={selectedStats}
        label=" BreakEven Shares"
        isPending={isPending}
        content={
          <span className="">
            {(costBasis / price).toFixed(4)} {unit}
          </span>
        }
      />
      <StatDisplay
        selectedStats={selectedStats}
        label=" BreakEven Price"
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
        selectedStats={selectedStats}
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
        selectedStats={selectedStats}
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
        selectedStats={selectedStats}
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
        selectedStats={selectedStats}
        label="Net Cash"
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
    </>
  );
};

export default SingleStat;
