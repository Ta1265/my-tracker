'use client';
/* eslint-disable react/jsx-key */

import { useTable, useSortBy } from 'react-table';
import type { Column } from 'react-table';
import { useRouter } from 'next/navigation';
import Table from '@mui/joy/Table';
import { DeltaCellMemo, DeltaHeaderMemo, DeltaSelectFilterMemo } from './stats-table/DeltaColumn';
import type { CoinSummaryResp } from '../../types/global';
import CurrentPrice from './stats-table/CurrentPrice';
import { ProfitLossCell, ProfitLossFilter, ProfitLossHeader } from './stats-table/ProfitLossColumn';
import { HoldingsCell } from './stats-table/HoldingsColumn';
import { CostBasisCell } from './stats-table/CostBasisColumn';
import { CoinColumnCell } from './stats-table/CoinColumn';
import SortArrow from './SortArrow';
import { useCoinSummaries } from '../_hooks/useCoinSummaries';
import Image from 'next/image';

const statsColumns: Column<CoinSummaryResp>[] = [
  {
    Header: ' ',
    myWidth: '35px',
    accessor: (row: CoinSummaryResp) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
      <Image
        src={`/${cell.value.productName}-icon.png`}
        alt={cell.value.productName}
        width={30}
        height={30}
      />
    ),
  },
  {
    Header: 'Coin',
    myWidth: '90px',
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
    // myWidth: '120px',
    accessor: (row: CoinSummaryResp) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
      <HoldingsCell coinSummary={cell.value} />
    ),
    sortType: (rowA: any, rowB: any, columnId: any) => {
      const aNum = rowA.values[columnId].valueOfHoldings;
      const bNum = rowB.values[columnId].valueOfHoldings;
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
      const aNum = rowA.values[columnId].costBasis;
      const bNum = rowB.values[columnId].costBasis;
      return aNum - bNum;
    },
  },
  {
    Header: 'Current Price',
    myWidth: '130px',
    accessor: (row: CoinSummaryResp) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
      <CurrentPrice coinSummary={cell.value} />
    ),
  },
  {
    Header: <DeltaHeaderMemo />,
    id: 'delta',
    myWidth: '100px',
    accessor: (row: CoinSummaryResp) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
      <DeltaCellMemo coinSummary={cell.value} />
    ),
    Filter: () => <DeltaSelectFilterMemo />,
  },
  {
    Header: <ProfitLossHeader />,
    id: 'total',
    accessor: (row: CoinSummaryResp) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResp } }) => (
      <ProfitLossCell coinSummary={cell.value} />
    ),
    Filter: () => <ProfitLossFilter />,
  },
];

export default function StatsTable() {
  const { data = [] } = useCoinSummaries();
  const router = useRouter();

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { columns: statsColumns, data },
    useSortBy,
  );

  return (
    <div
      className="gradient-border w-full"
      style={{ maxWidth: '960px', borderRadius: '12px', background: 'var(--bg-table)' }}
    >
      <div
        className="
           w-full
           overflow-x-auto
           overflow-y-visible
           scrollbar
           scrollbar-thin
           scrollbar-track-transparent
           scrollbar-thumb-gray-700
         "
        style={{
          overscrollBehavior: 'none',
          borderRadius: '12px',
          touchAction: 'pan-x pan-y',
        }}
      >
        <Table
          {...getTableProps()}
          className="table-fixed text-left"
          borderAxis="xBetween"
          variant="plain"
          size="md"
          stickyHeader={true}
          noWrap
          sx={{
            height: '100%',
            justifyContent: 'space-between',
            '& tr > *:first-child': {
              zIndex: 99,
              position: 'sticky',
              left: 0,
              bgcolor: 'var(--bg-table)',
            },
            '& thead th': {
              bgcolor: 'var(--bg-table)',
              borderBottom: '1px solid var(--border-medium)',
              textAlign: 'left',
              verticalAlign: 'middle',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            },
            '& tbody td': {
              textAlign: 'left',
              color: 'var(--text-secondary)',
              fontSize: '13px',
            },
            '& tbody tr': {
              borderBottom: '1px solid var(--border-subtle)',
            },
          }}
        >
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map((column: any) => (
                  <th
                    {...column.getHeaderProps()}
                    key={column.id}
                    style={{
                      ...(column.myWidth ? { width: column.myWidth } : { width: '110px' }),
                    }}
                  >
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
          <tbody {...getTableBodyProps()}>
            {rows.map((row) => {
              prepareRow(row);
              return (
                <tr
                  {...row.getRowProps()}
                  onClick={() => {
                    router.push(
                      `/product?unit=${encodeURIComponent(row.original.productName)}&name=${encodeURIComponent(row.original.coinName)}`
                    );
                  }}
                  style={{ cursor: 'pointer', background: 'transparent' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-table-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {row.cells.map((cell) => (
                    <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
