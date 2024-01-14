import Image from 'next/image';
import StatsTable from '../components/StatsTable';
import SummaryTable from '../components/SummaryTable';
import React, { useMemo, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import ProfitLossColumn from '../components/ProfitLossColumn';

const useGetStats = () => {
  const [stats, setStats] = useState<FormattedProductStats[]>([]);
  const [summary, setSummary] = useState<StatsSummary[]>([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/stats/all')
      .then((res) => res.json())
      .then(({ stats, summary }) => {
        setStats(stats);
        setSummary(summary);
        setLoading(false);
      });
  }, []);

  return { stats, summary, isLoading };
};

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
        Header: 'Product',
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
        }) => {
          return (
            <div
              className="flex items-center text-center"
              style={{
                position: 'sticky',
                zIndex: 100,
                background: 'inherit',
              }}
            >
              <Image
                src={`/${productName}-icon.png`}
                alt={productName}
                width={40}
                height={40}
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
          value: { holdings: string; valueOfHoldings: string };
        }) => (
          <div className="text-center">
            <span>{valueOfHoldings}</span>
            <br></br>
            <span className="text-xl md:text-base lg:text-base xl:text-sm">
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
      {
        Header: 'Avg. Buy',
        accessor: 'avgPurchasePrice',
        sortType: sortDollars,
      },
      {
        Header: 'Break Even',
        accessor: 'breakEvenPrice',
        sortType: sortDollars,
      },
      {
        Header: 'Cur. Price',
        accessor: 'currentPrice',
        sortType: sortDollars,
      },
      {
        Header: `%`,
        accessor: (row: any) => ({
          unit: row.productName,
          coinName: row.coinName,
          currentPrice: row.currentPrice,
        }),
        Cell: ({
          cell: {
            value: { unit, coinName, currentPrice },
          },
        }: {
          cell: {
            value: {
              unit: string;
              coinName: string;
              currentPrice: string;
            };
          };
        }) => (
          <ProfitLossColumn
            coinName={coinName}
            selectedTimeFrame={selectedTimeFrame}
            currentPrice={currentPrice}
          />
        ),
        sortType: () => 0,
        Filter: ({ column }) => (
          <>
            <select
              className="
            hover:border-grey-700
            bg-gray-700
            text-center
            text-sm
            dark:bg-black
          "
              onChange={({ target: { value } }: any) => {
                setSelectedTimeFrame(value);
              }}
              defaultValue={selectedTimeFrame}
            >
              <option value="h">Hour</option>
              <option value="d">Day</option>
              <option value="w">Week</option>
              <option value="m">Month</option>
              <option value="3m">3 Month</option>
              <option value="6m">6 Month</option>
              <option value="y">1 Year</option>
              <option value="all">All Time</option>
            </select>
          </>
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

  if (isLoading) return <div></div>;

  return (
    <>
      <div className="flex justify-center py-5">
        <SummaryTable data={summary[0]} />
      </div>

      <br />

      <div
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
      >
        <StatsTable columns={statsColumns} data={stats} />
      </div>
    </>
    // <main
    //   className="
    //   flex
    //   flex-col
    //   items-center
    //   justify-center
    //   py-10
    //   "
    // >
    // <div
    //   className="
    //       mx-auto
    //       px-5
    //       py-5
    //     "
    // >
  );
}

Stats.auth = true;
