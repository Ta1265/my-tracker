/* eslint-disable react/jsx-key */
import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import Table from '@mui/joy/Table';
import { Box } from '@mui/joy';

type DataType = {
  [key: string]: any;
};

interface SummaryTableProps {
  data: {
    purchases: string;
    sales: string;
    costBasis: string;
    valueOfHoldings: string;
    totalPLatCurrentPrice: string;
    netCashHoldings: string;
    netContributions: string;
    accountValue: string;
    realizedReturn: string;
    roi: string;
    inGreen: boolean;
  };
}

interface row {
  label: string;
  sign: string;
  value: any;
  end?: boolean;
}

const InfoTable: React.FC<{
  rows: row[];
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


const SummaryTable: React.FC<SummaryTableProps> = ({ data }) => {
  const [showBreakdown, setShowBreakdown] = React.useState(false);

  const loading = !data;

  const inGreen = data?.inGreen;

  if (showBreakdown && !loading) {
    return (
      <div
        className="flex flex-wrap justify-center"
        onClick={() => setShowBreakdown(!showBreakdown)}
      >
        <InfoTable
          rows={[
            { label: 'Net Cash:', sign: '', value: data.netCashHoldings },
            {
              label: 'Net Contrib.:',
              sign: '-',
              value: data?.netContributions,
            },
            {
              end: true,
              label: 'Realized:',
              sign: '',
              value: data.realizedReturn,
            },
          ]}
        />
        <InfoTable
          rows={[
            { label: 'Purchases:', sign: '', value: data.purchases },
            { label: 'Sales:', sign: '-', value: data.sales },
            {
              end: true,
              label: 'Cost Basis:',
              sign: '',
              value: data.costBasis,
            },
          ]}
        />
        <InfoTable
          rows={[
            { label: 'Holdings Value:', sign: '', value: data.valueOfHoldings },
            { label: 'Cost Basis:', sign: '-', value: data.costBasis },
            {
              end: true,
              label: 'Total P/L:',
              sign: '',
              value: data.totalPLatCurrentPrice,
            },
          ]}
        />
        <InfoTable
          rows={[
            {
              label: 'Total P/L:',
              sign: '',
              value: data.totalPLatCurrentPrice,
            },
            { label: 'Net Contrib.:', sign: '÷', value: data.netContributions },
            { end: true, label: 'ROI:', sign: '', value: data.roi },
          ]}
        />
      </div>
    );
  }

  const TotalTd: React.FC<{ content: React.ReactNode }> = ({
    content,
  }) => {
    return (
      <td
        className="text-center w"
        style={{ color: inGreen ? '#27AD75' : '#F0616D' }}
      >
        {loading ? (
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
            overlay={true}
            loading={loading}
          >
            ....
          </Skeleton>
        ) : (
          content
        )}
      </td>
    );
  };

  return (
    <table
      className="table-auto cursor-pointer"
      onClick={() => setShowBreakdown(!showBreakdown)}
    >
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
          <th className="px-5 py-2 text-center">Total Account Value</th>

          <th className="px-5 py-2 text-center">Total P/L</th>
          <th className="px-5 py-2 text-center"></th>
        </tr>
      </thead>
      <tbody className="sm:text-lg md:text-xl lg:text-2xl">
        <tr>
            <TotalTd content={<>{data?.accountValue}</>} />
            <TotalTd content={<>{data?.accountValue}</>} />
            <TotalTd
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
