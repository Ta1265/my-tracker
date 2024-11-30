/* eslint-disable react/jsx-key */
import { useTable, useSortBy, useFilters} from 'react-table';
import type { Column } from 'react-table';
import React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Table from '@mui/joy/Table';
import SortArrow from './SortArrow';
import { useQuery } from '@tanstack/react-query';
import ProfitLossColumn from '../components/ProfitLossColumn';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import type { CoinSummaryResp } from '../../types/global';
import Image from 'next/image';
import useWindowSize from '../_hooks/windowResize';


const sortDollars = (rowA: any, rowB: any, columnId: string) => {
  const aNum = parseFloat(rowA.values[columnId].replace(/[$,]/g, ''));
  const bNum = parseFloat(rowB.values[columnId].replace(/[$,]/g, ''));
  return aNum - bNum;
};


const StatsTableComponent: React.FC<{
  data: CoinSummaryResp[];
  columns: Column<CoinSummaryResp>[];
  screenWidth: number;
}> = ({data, columns, screenWidth}) => {
  const router = useRouter();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { columns,  data },
    useSortBy,
  );

  const [loaded, setLoaded ] = useState(false);

  React.useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollLeft = scrollContainer.scrollWidth;

      const distanceToTop = scrollContainer.getBoundingClientRect().top + 8;

      scrollContainer.style.setProperty('--distance-to-top', `${distanceToTop}px`);
    }

    setTimeout(() => {
      setLoaded(true);
    }, 500);
  }, []);


  return (
    <div
      ref={scrollContainerRef}
      className="
         w-full
         overflow-x-auto
         overflow-y-auto
         scrollbar
         scrollbar-thin
         scrollbar-track-transparent
         scrollbar-thumb-gray-400
         dark:text-gray-400
       "
      style={{
        maxWidth: '910px',
        maxHeight: `calc(100vh - var(--distance-to-top))`,
      }}
    >
      <Table
        {...getTableProps()}
        className="
          table-fixed 
          text-left 
        "
        borderAxis="xBetween"
        variant="plain"
        size={screenWidth && screenWidth < 768 ? 'sm' : 'lg'}
        stickyHeader={true}
        sx={{
          justifyContent: 'space-between',
          minWidth: 'min-content',
          '& thead th': {
            backgroundColor: '#000',
            borderBottomWidth: '3px',
          },
        }}
      >
        <thead
          className="
            uppercase
          "
        >
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column, columnIndex) => {
                if (column.Filter) {
                  return (
                    <th
                      className="dark:text-gray-400"
                      {...column.getHeaderProps()}
                      style={{
                        ...(columnIndex === 0 && {
                          position: 'sticky',
                          left: '0px',
                          zIndex: 53,
                        }),
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        width: screenWidth && screenWidth < 768 ? '80px' : '120px',
                        paddingLeft: '5px',
                        paddingRight: '5px',
                      }}
                    >
                      {column.render('Filter')}
                    </th>
                  );
                }
                return (
                  <th
                    {...column.getHeaderProps(column.getSortByToggleProps())}
                    key={column.id}
                    className="dark:text-gray-400"
                    style={{
                      ...(columnIndex === 0 && {
                        position: 'sticky',
                        left: '0px',
                        zIndex: 53,
                      }),
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      width: screenWidth && screenWidth < 768 ? '100px' : '128px',
                      paddingLeft: '5px',
                      paddingRight: '5px',
                    }}
                  >
                    <SortArrow isSorted={column.isSorted} isSortedDesc={column.isSortedDesc}>
                      {column.render('Header')}
                    </SortArrow>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody
          {...getTableBodyProps()}
          className="
            dark:black
            border-b
            bg-white
            dark:border-gray-700
            dark:bg-black
          "
        >
          {rows.map((row, rowIndex) => {
            prepareRow(row);
            return (
              <>
                <tr
                  {...row.getRowProps()}
                  onClick={() => {
                    router.push(`/product/${row.original.productName}`);
                  }}
                  className={`
                  ease-in-out-out
                  transform transform
                  border-gray-800
                  transition-transform
                  duration-500
                  ${loaded ? 'translate-y-0' : '-translate-y-5'}
                `}
                  style={{
                    cursor: 'pointer',
                    background: 'inherit',
                    transitionDelay: `${rowIndex * 0.005}s`,
                  }}
                >
                  {row.cells.map((cell, cellIndex) => (
                    <td
                      {...cell.getCellProps()}
                      className={`
                        justify-center
                        text-center
                        transition-opacity
                        duration-500
                        md:py-5
                        xl:px-6
                        ${loaded ? 'opacity-100' : 'opacity-0'}
                      `}
                      style={{
                        transitionDelay: `${rowIndex * 0.05}s`,
                        ...(cellIndex === 0 && {
                          position: 'sticky',
                          left: 0,
                          zIndex: 53,
                          background: 'inherit',
                        }),
                      }}
                    >
                      {cell.render('Cell')}
                    </td>
                  ))}
                </tr>
              </>
            );
          })}
        </tbody>
      </Table>
    </div>
  );

};

const StatsTable: React.FC<{}> = () => {
  const router = useRouter();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>('d');
  const { width: screenWidth } = useWindowSize();

  const {
    isPending,
    isRefetching,
    isError,
    data = [],
    error,
  } = useQuery({
    queryKey: ['summary', 'all-coins'],
    queryFn: async ({ signal }): Promise<CoinSummaryResp[]> => {
      const resp = await fetch(`/api/summary/coins`, { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
  });


  const statsColumns: Column<CoinSummaryResp>[] = React.useMemo(
    () => [
      {
        Header: 'Coin',
        // accessor: 'productName',
        accessor: (row: any) => ({
          productName: row.productName,
          coinName: row.coinName,
        }),
        sortType: (rowA: any, rowB: any, columnId: any) => {
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
                justifyContent: 'left',
              }}
            >
              <Image src={`/${productName}-icon.png`} alt={productName} width={30} height={30} />
              <span className="ml-2"> {productName}</span>
            </div>
          );
        },
      },
      {
        Header: 'Holdings',
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
            <span className="">{holdings}</span>
          </div>
        ),

        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = parseFloat(rowA.values[columnId].valueOfHoldings.replace(/[$,]/g, ''));
          const bNum = parseFloat(rowB.values[columnId].valueOfHoldings.replace(/[$,]/g, ''));
          return aNum - bNum;
        },
      },
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
        Filter: () => (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              minWidth: 'fit-content',
            }}
          >
            <Select
              className="uppercase dark:text-gray-400"
              onChange={(
                event: React.SyntheticEvent | null,
                newValue: 'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all' | null,
              ) => {
                if (newValue) {
                  setSelectedTimeFrame(newValue);
                }
              }}
              defaultValue={selectedTimeFrame}
              sx={{
                border: 0,
                textAlign: 'center',
                fontSize: 'inherit',
                backgroundColor: 'inherit',
              }}
            >
              <Option value="h">HOUR</Option>
              <Option value="d">DAY</Option>
              <Option value="w">WEEK</Option>
              <Option value="m">1 M</Option>
              <Option value="3m">3 M</Option>
              <Option value="6m">6 M</Option>
              <Option value="y">1 Y</Option>
              <Option value="all">ALL</Option>
            </Select>
          </div>
        ),
      },
      {
        Header: 'Profit/Loss',
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
  

  return (
    <StatsTableComponent data={data} columns={statsColumns} screenWidth={screenWidth} />
  );
};


export default StatsTable;
