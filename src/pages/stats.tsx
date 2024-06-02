import Image from 'next/image';
import StatsTable from '../components/StatsTable';
import StatsTableNewest from '../components/StatsTableNewest';
import SummaryTable from '../components/SummaryTable';
import React, { useMemo, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import ProfitLossColumn from '../components/ProfitLossColumn';
import { useGetStats } from '../_hooks/useGetStats';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import dynamic from 'next/dynamic';

const sortDollars = (rowA: any, rowB: any, columnId: string) => {
  const aNum = parseFloat(rowA.values[columnId].replace(/[$,]/g, ''));
  const bNum = parseFloat(rowB.values[columnId].replace(/[$,]/g, ''));
  return aNum - bNum;
};

export default function Stats() {
  const { stats, summary, isLoading } = useGetStats();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>('d');

  const statsColumns = useMemo(
    () => [
      {
        Header: 'Coin',
        // accessor: 'productName',
        accessor: (row: any) => ({
          productName: row.productName,
          coinName: row.coinName,
        }),
        sortType: (rowA, rowB, columnId) => {
          const a = rowA.values[columnId].productName;
          const b = rowB.values[columnId].productName;
          return a > b ? 1 : -1;
        },
        Cell: ({
          cell: {
            value: { productName },
          },
        }: {
          cell: { value: { productName: string } };
        }) => {
          return (
            <div
              className="flex items-center text-center"
              style={{
                position: 'sticky',
                background: 'inherit',
              }}
            >
              <Image
                src={`/${productName}-icon.png`}
                alt={productName}
                width={30}
                height={30}
              />
              <span className="ml-2"> {productName}</span>
            </div>
          );
        },
      },
      {
        Header: 'Holdings',
        // accessor: "holdings",
        accessor: (row: any) => ({
          holdings: row.holdings,
          valueOfHoldings: row.valueOfHoldings,
        }),
        Cell: ({
          cell: {
            value: { holdings, valueOfHoldings },
          },
        }: {
          cell: {
            value: { holdings: string; valueOfHoldings: string };
          };
        }) => (
          <div className="text-center">
            <span>{valueOfHoldings}</span>
            <br></br>
            <span className="">
              {holdings}
            </span>
          </div>
        ),

        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = parseFloat(
            rowA.values[columnId].valueOfHoldings.replace(/[$,]/g, ''),
          );
          const bNum = parseFloat(
            rowB.values[columnId].valueOfHoldings.replace(/[$,]/g, ''),
          );
          return aNum - bNum;
        },
      },
      // {
      //   Header: 'Avg. Buy',
      //   accessor: 'avgPurchasePrice',
      //   sortType: sortDollars,
      // },
      {
        Header: 'Break even',
        accessor: 'breakEvenPrice',
        sortType: sortDollars,
      },
      {
        Header: 'Cur. Price',
        accessor: 'currentPrice',
        sortType: sortDollars,
      },
      {
        Header: ` `,
        accessor: (row: any) => ({
          unit: row.productName,
          coinName: row.coinName,
          currentPrice: row.currentPrice,
          holdings: row.holdings,
        }),
        Cell: ({
          cell: {
            value: { unit, coinName, currentPrice, holdings },
          },
        }: {
          cell: {
            value: {
              unit: string;
              coinName: string;
              currentPrice: string;
              holdings: string;
            };
          };
        }) => (
          <ProfitLossColumn
            coinName={coinName}
            selectedTimeFrame={selectedTimeFrame}
            currentPrice={currentPrice}
            holdings={holdings}
          />
        ),
        sortType: () => 0,
        Filter: ({ column }) => (
          <div style={{ display: 'flex', justifyContent: 'right', width: '110px' }}>
            <Select
              onChange={(
                event: React.SyntheticEvent | null,
                newValue: 'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all',
              ) => {
                setSelectedTimeFrame(newValue);
              }}
              defaultValue={selectedTimeFrame}
              sx={{
                border: 0,
                textAlign: 'center',
                width: '100px',
                fontSize: '14px'
              }}
            >
              <Option value="h">Hour</Option>
              <Option value="d">Day</Option>
              <Option value="w">Week</Option>
              <Option value="m">1 M</Option>
              <Option value="3m">3 M</Option>
              <Option value="6m">6 M</Option>
              <Option value="y">1 Y</Option>
              <Option value="all">All</Option>
            </Select>
          </div>
        ),
      },
      {
        Header: 'P/L',
        accessor: (row: any) => ({
          profitLossAtCurrentPrice: row.profitLossAtCurrentPrice,
          percentPL: row.percentPL,
          unit: row.productName,
          coinName: row.coinName,
        }),
        Cell: ({
          cell: {
            value: { profitLossAtCurrentPrice, percentPL, unit, coinName },
          },
        }: {
          cell: {
            value: {
              profitLossAtCurrentPrice: string;
              percentPL: string;
              unit: string;
              coinName: string;
            };
          };
        }) => (
          <div
            className="text-center"
            style={{ color: percentPL[0] === '-' ? '#F0616D' : '#27AD75' }}
          >
            <span>{profitLossAtCurrentPrice} </span>
            <br></br>
            <span className="text-xl text-xs md:text-base lg:text-base xl:text-sm">
              {' '}
              {percentPL}
            </span>
          </div>
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = parseFloat(
            rowA.values[columnId].profitLossAtCurrentPrice.replace(/[$,]/g, ''),
          );
          const bNum = parseFloat(
            rowB.values[columnId].profitLossAtCurrentPrice.replace(/[$,]/g, ''),
          );
          return aNum - bNum;
        },
      },
    ],
    [selectedTimeFrame],
  );

  // if (isLoading) return <div></div>;

  return (
    <>
      <div className="mx-auto" style={{
      }}>
        <div className="sm:py-4 py-3 flex justify-center">
          <SummaryTable data={summary[0]} />
        </div>
      </div>

      <br />

      {/* <div
        className="
         xs:max-h-[900px]
         max-h-[1200px]
         scrollbar
         scrollbar-thin
         scrollbar-track-transparent
         scrollbar-thumb-gray-400
         dark:text-gray-400
         sm:max-h-[700px]
         lg:max-h-[700px]
         xl:max-h-[700px]
       "
        style={{
          minWidth: '900px',
          maxWidth: '900px',
          overflowY: 'auto',
          overflowX: 'auto',
        }}
      > */}
      <StatsTableNewest columns={statsColumns} data={stats} />
      {/* </div> */}
    </>
  );
}

Stats.auth = true;
