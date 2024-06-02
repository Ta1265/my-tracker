/* eslint-disable react/jsx-key */
import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import Table from '@mui/joy/Table';
import { Box } from '@mui/joy';

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
        table-auto 
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
          sm:text-xl
          md:text-2xl        
          lg:text-2xl
          "
      >
        <tr>
          <th
            className="
              py-2
              px-5 
              text-center
            "
          >
            Total Value
          </th>
          <th
            className="
              py-2
              px-5 
              text-center
              "
          >
            Total P/L
          </th>
          <th
           className="
              py-2
              px-5 
              text-center
              "
          ></th>
        </tr>
      </thead>
      <tbody
        className="
          sm:text-lg
          md:text-xl        
          lg:text-2xl
        "
      >
        <tr>
          {/* <td className="text-center xs:text-xl sm:text-2xl sm:py-2 md:py-4"> */}
          <td className="text-center">
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
            // className="text-center xs:text-xl sm:text-2xl sm:py-2 md:py-4"
            className="text-center"
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
                {/* <span className="px-4 text-center"> */}
                {data.totalPLatCurrentPrice}
                {/* </span> */}
              </>
            )}
          </td>
          <td
            // className="text-center xs:text-xl sm:text-2xl sm:py-2 md:py-4"
            className="text-center"
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
                <div style={{ whiteSpace: 'nowrap' }}>
                  {inGreen ? '▲' : '▼'} {data.totalPercentPL}
                </div>
              </>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default SummaryTable; /* eslint-disable react/jsx-key */
