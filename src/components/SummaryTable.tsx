/* eslint-disable react/jsx-key */
import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import type { PortfolioSummary } from '../../types/global';
import { useQuery } from '@tanstack/react-query';

const InfoTable: React.FC<{
  rows: {
    label: string;
    sign: string;
    value: any;
    end?: boolean;
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
          {rows.map((row: any) => (
            <tr key={row.label} className={row.end ? 'border-t' : ''}>
              <td className="pr-4 text-right">{row.label}</td>
              <td>{row.sign}</td>
              <td>{row.value}</td>
            </tr>
          ))}
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
    <td className="text-center" style={{ color: inGreen ? '#27AD75' : '#F0616D' }}>
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

const SummaryTable: React.FC<{}> = () => {
  const { isPending, isRefetching, isRefetchError, isError, data, error } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async ({ signal }): Promise<PortfolioSummary> => {
      const resp = await fetch('/api/summary/portfolio', { signal })
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
  });

  const [showBreakdown, setShowBreakdown] = React.useState(false);

  const inGreen = data?.inGreen || false;

  const isLoading = isPending || isRefetching;

  if (isError || isRefetchError) {
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
            { end: true, label: 'ROI:', sign: '', value: data?.roi },
          ]}
        />
      </div>
    );
  }

  return (
    <table className="table-auto cursor-pointer" onClick={() => setShowBreakdown(!showBreakdown)}>
      <thead
        className="
          text-gray-700
          text-gray-700
          dark:text-gray-400
          sm:text-xl
          md:text-2xl
          lg:text-2xl
          "
      >
        <tr>
          <th className="px-5 py-2 text-center">Total Value</th>

          <th className="px-5 py-2 text-center">Total P/L</th>
          <th className="px-5 py-2 text-center" style={{ visibility: 'hidden' }}>
            Total P/L
          </th>
        </tr>
      </thead>
      <tbody className="sm:text-lg md:text-xl lg:text-2xl">
        <tr>
          <TotalTd isPending={isLoading} inGreen={inGreen} content={<>{data?.accountValue}</>} />
          <TotalTd
            isPending={isLoading}
            inGreen={inGreen}
            content={<>{data?.totalPLatCurrentPrice}</>}
          />
          <TotalTd
            isPending={isLoading}
            inGreen={inGreen}
            content={
              <div style={{ whiteSpace: 'nowrap' }}>
                {inGreen ? '▲' : '▼'} {data?.roi}
              </div>
            }
          />
        </tr>
      </tbody>
    </table>
  );
};

export default SummaryTable; /* eslint-disable react/jsx-key */
