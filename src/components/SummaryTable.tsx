/* eslint-disable react/jsx-key */
import React from 'react';
import Skeleton from '@mui/joy/Skeleton';

type DataType = {
  [key: string]: any;
};

interface SummaryTableProps {
  data: StatsSummary;
}

const SummaryTable: React.FC<SummaryTableProps> = ({ data }) => {
  // if (!data) {
  //   return <div>Loading...</div>;
  // }
  const loading = !data;

  const inGreen = data
    ? parseFloat(data.totalPLatCurrentPrice.replace(/[^0-9.-]+/g, '')) > 0
    : false;

  return (
    // <div className="flex justify-center">
    <table className="text-grey-700 flex table text-left text-2xl text-gray-500 dark:text-gray-400">
      <thead className="justify-between text-4xl text-gray-700 text-gray-700 dark:text-gray-400 md:text-lg">
        <tr>
          <th className="px-10 py-4">Total Value</th>
          <th className="px-10 py-4 text-center">Total P/L</th>
        </tr>
      </thead>
      <tbody>
        <tr className="text-4xl md:text-lg lg:text-2xl">
          <td className="text-center">
            <span className="text-center">
              {loading ? (
                <Skeleton
                  variant="rectangular"
                  width={150}
                  height={34}
                  overlay={true}
                  loading={true}
                />
              ) : (
                <>{data.totalValueOfHoldings}</>
              )}
            </span>
          </td>
          <td
            className="text-center"
            style={{
              ...(inGreen ? { color: '#27AD75' } : { color: '#F0616D' }),
            }}
          >
            {loading ? (
              <Skeleton
                variant="rectangular"
                width={258}
                height={34}
                overlay={true}
                loading={true}
              />
            ) : (
              <>
                <span className="px-4 text-center">
                  {data.totalPLatCurrentPrice}
                </span>
                <span className="px-4 text-center">
                  {inGreen ? '▲' : '▼'} {data.totalPercentPL}
                </span>
              </>
            )}
          </td>
        </tr>
      </tbody>
    </table>
    // </div>
  );
};

export default SummaryTable; /* eslint-disable react/jsx-key */
