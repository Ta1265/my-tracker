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
    <table
      className="
        text-grey-700 
        flex 
        table 
        text-left 
        text-gray-500 
        dark:text-gray-400 
        "
    >
      <thead
        className="
          justify-between 
          text-gray-700 
          text-gray-700 
          dark:text-gray-400
          "
      >
        <tr>
          <th
            className="
              px-10 
              xs:text-xl
              sm:text-2xl
              sm:py-2
              md:py-4 
              "
          >
            Total Value
          </th>
          <th 
            className="
              px-10 
              text-center 
              xs:text-xl
              sm:text-2xl
              sm:py-2
              md:py-4 
              "
            >
              Total P/L
            </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="text-center xs:text-xl sm:text-2xl sm:py-2 md:py-4">
            <span className="text-center">
              {loading ? (
                <Skeleton
                  variant="rectangular"
                  width="100%"
                  height="100%"
                  overlay={true}
                  loading={true}
                />
              ) : (
                <>{data.totalValueOfHoldings}</>
              )}
            </span>
          </td>
          <td
            className="text-center xs:text-xl sm:text-2xl sm:py-2 md:py-4"
            style={{
              ...(inGreen ? { color: '#27AD75' } : { color: '#F0616D' }),
            }}
          >
            {loading ? (
              <Skeleton
                variant="rectangular"
                width="100%"
                height="100%"
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
