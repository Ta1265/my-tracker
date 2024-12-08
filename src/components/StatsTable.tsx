/* eslint-disable react/jsx-key */
import { useTable, useSortBy, useFilters} from 'react-table';
import type { Column } from 'react-table';
import React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Table from '@mui/joy/Table';
import SortArrow from './SortArrow';
import { useQuery } from '@tanstack/react-query';
import { PercentChangeCell, PercentChangeCellMemo, PercentChangeFilter, PercentChangeFilterMemo } from './PercentChangeColumn';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import type { CoinSummaryResp } from '../../types/global';
import Image from 'next/image';
import useWindowSize from '../_hooks/windowResize';
import CurrentPrice from './CurrentPrice';
import { ProfitLossCell, ProfitLossFilter } from './ProfitLossColumn';
import Box from '@mui/material/Box';
import Tooltip from '@mui/joy/Tooltip';
import { HoldingsCell } from './HoldingsColumn';
import { CostBasisCell } from './CostBasisColumn';
import { CoinColumnCell } from './CoinColumn';


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
         scrollbar-thumb-gray-700
         dark:text-gray-400
       "
      style={{
        maxWidth: '900px',
        maxHeight: `calc(100vh - var(--distance-to-top))`,
      }}
    >
      <Table
        {...getTableProps()}
        className="table-fixed text-left"
        borderAxis="xBetween"
        variant="plain"
        size={'md'}
        stickyHeader={true}
        noWrap
        sx={{
          justifyContent: 'space-between',
          '& tr > *:first-child': {
            zIndex: 99,
            position: 'sticky',
            left: 0,
            bgcolor: '#000',
            width: '110px'
          },
          '& thead th': {
            bgcolor: '#000',
            borderBottomWidth: '3px',
            textAlign: 'left',
            verticalAlign: 'middle',
            width: '130px',
          },
          '& tbody td': {
            textAlign: 'left',
          },
        }}
      >
        <thead className="uppercase">
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column, columnIndex) => (
                <th className="dark:text-gray-400" {...column.getHeaderProps()} key={column.id}>
                  <span className="flex flex-row items-center">
                    <span style={{ visibility: 'hidden' }}> ▲ </span>
                    <SortArrow isSorted={column.isSorted} isSortedDesc={column.isSortedDesc}>
                      <span {...column.getSortByToggleProps()}>{column.render('Header')}</span>
                    </SortArrow>
                    {column.Filter && column.render('Filter')}
                  </span>
                </th>
              ))}
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
                        transition-opacity
                        duration-500
                        ${loaded ? 'opacity-100' : 'opacity-0'}
                      `}
                      style={{
                        transitionDelay: `${rowIndex * 0.05}s`,
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
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>('d');
  const [selectedPlType, setSelectedPlType] = useState<'roi' | 'ror'>('roi');

  const { width: screenWidth } = useWindowSize();

  const {
    data = [],
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
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <CoinColumnCell coinSummary={cell.value} />
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const a = rowA.values[columnId].productName;
          const b = rowB.values[columnId].productName;
          return a > b ? 1 : -1;
        },
      },
      {
        Header: 'Holdings',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <HoldingsCell coinSummary={cell.value} />
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = rowA.values[columnId].valueOfHoldings
          const bNum = rowB.values[columnId].valueOfHoldings
          return aNum - bNum;
        },
      },
      {
        Header: 'Cost Basis',
        title: 'Cost Basis / Break Even',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <CostBasisCell coinSummary={cell.value} />
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = rowA.values[columnId].costBasis
          const bNum = rowB.values[columnId].costBasis
          return aNum - bNum;
        },
      },
      {
        Header: 'Cur. Price',
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <CurrentPrice
            unit={cell.value.productName}
            backupCurrentPrice={cell.value.currentPrice}
          />
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = rowA.values[columnId].currentPrice
          const bNum = rowB.values[columnId].currentPrice
          return aNum - bNum
        },
      },
      {
        Header: `Delta - ${selectedTimeFrame}`,
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <PercentChangeCellMemo coinSummary={cell.value} selectedTimeFrame={selectedTimeFrame} />
        ),
        Filter: () => (
          <PercentChangeFilterMemo
            selectedTimeFrame={selectedTimeFrame}
            setSelectedTimeFrame={setSelectedTimeFrame}
          />
        ),
      },
      {
        Header: `Total ${selectedPlType}`,
        accessor: (row: CoinSummaryResp) => row,
        Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
          <ProfitLossCell coinSummary={cell.value} selectedPlType={selectedPlType} />
        ),
        Filter: () => (
          <ProfitLossFilter selectedPlType={selectedPlType} setSelectedPlType={setSelectedPlType} />
        ),
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const aNum = rowA.values[columnId].profitLossAtCurrentPrice;
          const bNum = rowB.values[columnId].profitLossAtCurrentPrice;
          return aNum - bNum;
        },
      },
    ],
    [selectedTimeFrame, selectedPlType],
  );
  

  return (
    <StatsTableComponent data={data} columns={statsColumns} screenWidth={screenWidth} />
  );
};


export default StatsTable;
