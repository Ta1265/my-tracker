/* eslint-disable react/jsx-key */
import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import type { PortfolioSummary, TimeFrameTotalPlResp } from '../../types/global';
import { useQuery } from '@tanstack/react-query';
import TickerDisplay from './TickerDisplay';
import { DeltaSelectFilterMemo } from './stats-table/DeltaColumn';
import { useStatsTableContext } from '../context/StatsTableContext';
import { timeFrameDisplay } from './SingleStat';

const InfoTable: React.FC<{
  rows: {
    label: string;
    sign: string;
    value: number;
    end?: boolean;
    type?: 'PERCENTAGE' | 'USD';
  }[];
}> = ({ rows }) => {

  return (
    <div
      className="
      flex-col
      px-2 py-2
    "
    >
      <table
        className="
        table-auto
        cursor-pointer
        text-xs
        md:text-base
      "
      >
        <tbody
          className="
          text-md
          justify-between
          px-2 
          py-2 
          text-gray-700
          text-gray-700
          dark:text-gray-400
        "
        >
          {rows.map((row: any) => { 
            const val = row.type === 'PERCENTAGE' ? `${row.value.toFixed(2)}%` : row.value.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
              minimumFractionDigits: 0,
            });
            return (
            <tr key={row.label} className={row.end ? 'border-t' : ''}>
              <td className="pr-4 text-right">{row.label}</td>
              <td>{row.sign}</td>
              <td>{val}</td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
};

const TotalTd: React.FC<{ content: React.ReactNode; isPending: boolean; inGreen: boolean }> = ({
  content,
  isPending,
  inGreen,
}) => {
  return (
    <td className="px-5 text-center" style={{ color: inGreen ? '#27AD75' : '#F0616D' }}>
      {isPending ? (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          overlay={true}
          loading={isPending}
        >
          ....
        </Skeleton>
      ) : (
        content
      )}
    </td>
  );
};

const SummaryTable: React.FC<{
}> = () => {

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
      <div
        className="flex flex-wrap justify-center"
        onClick={() => setShowBreakdown(!showBreakdown)}
      >
        <InfoTable
          rows={[
            { label: 'Net Cash:', sign: '', value: data?.netCashHoldings },
            {
              label: 'Net Contrib.:',
              sign: '-',
              value: data?.netContributions,
            },
            {
              end: true,
              label: 'Realized:',
              sign: '',
              value: data?.realizedReturn,
            },
          ]}
        />
        <InfoTable
          rows={[
            { label: 'Purchases:', sign: '', value: data?.purchases },
            { label: 'Sales:', sign: '-', value: data?.sales },
            {
              end: true,
              label: 'Cost Basis:',
              sign: '',
              value: data?.costBasis,
            },
          ]}
        />
        <InfoTable
          rows={[
            { label: 'Holdings Value:', sign: '', value: data?.valueOfHoldings },
            { label: 'Cost Basis:', sign: '-', value: data?.costBasis },
            {
              end: true,
              label: 'Total P/L:',
              sign: '',
              value: data?.totalPLatCurrentPrice,
            },
          ]}
        />
        <InfoTable
          rows={[
            {
              label: 'Total P/L:',
              sign: '',
              value: data?.totalPLatCurrentPrice,
            },
            { label: 'Net Contrib.:', sign: '÷', value: data?.netContributions },
            { end: true, label: 'ROI:', sign: '', value: data?.roi, type: 'PERCENTAGE' },
          ]}
        />
      </div>
    );
  }

  return (
    <div
      className="
        text-grey-700 
        justify-space-between
        text-md
        flex
        flex-row 
        flex-wrap
        justify-left
        md:justify-center
        text-sm
        sm:text-sm
        md:text-md
        lg:text-md
        xl:text-md
      "
      // onClick={() => setShowBreakdown(!showBreakdown)}
    >
      <div className="flex flex-col px-3" onClick={() => setShowBreakdown(!showBreakdown)}>
        <div className="flex-basis-1/3 py-1 text-center font-bold">Total Value </div>
        <Skeleton loading={isPending} variant="rectangular">
          <div
            className="text-left"
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
        className="flex-basis-2/3 flex flex-col px-3"
        onClick={() => setShowBreakdown(!showBreakdown)}
      >
        <div className="py-1 text-left font-bold">Total P/L </div>
        <Skeleton loading={isPending} variant="rectangular" overlay>
          <div
            className="text-left"
            style={{
              color: inGreen ? '#27AD75' : '#F0616D',
            }}
          >
            <span className="flex flex-row">
              <span>
                <TickerDisplay
                  value={data?.totalPLatCurrentPrice || 0}
                  format={'USD'}
                  fracDigits={2}
                  type={'animate'}
                />
              </span>
              <span>&nbsp;</span>
              <span>
                {'('}
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

      <div className="flex-basis-1/3 flex flex-col px-3">
        <div className="flex max-h-[28px] flex-row items-center text-center font-bold capitalize">
          <span style={{ visibility: 'hidden' }}> ▲ </span>
          P/L - {timeFrameDisplay[selectedTimeFrame]}
          <DeltaSelectFilterMemo />
        </div>
        <Skeleton loading={timeFramePlLoading} variant="rectangular">
          <div
            className=""
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
            <span>&nbsp;</span>
            <span>
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
