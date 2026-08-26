'use client';
/* eslint-disable react/jsx-key */

import { useTable, useSortBy } from 'react-table';
import type { Column } from 'react-table';
import { useRouter } from 'next/navigation';
import Table from '@mui/joy/Table';
import { DeltaCellMemo, DeltaHeaderMemo, DeltaSelectFilterMemo } from './stats-table/DeltaColumn';
import type { CoinSummaryResponseDto } from '../api/generated';
import { useCoinSummaries } from '../api/generated';
import CurrentPrice from './stats-table/CurrentPrice';
import { ProfitLossCell, ProfitLossFilter, ProfitLossHeader } from './stats-table/ProfitLossColumn';
import { HoldingsCell } from './stats-table/HoldingsColumn';
import { CostBasisCell } from './stats-table/CostBasisColumn';
import { CoinColumnCell } from './stats-table/CoinColumn';
import SortArrow from './SortArrow';
import Image from 'next/image';
import { ColumnVisibilityDropdown } from './stats-table/ColumnVisibilityDropdown';
import { useStatsTableContext } from '../context/StatsTableContext';
import { useMemo } from 'react';

const EMPTY_STATS_DATA: CoinSummaryResponseDto[] = [];

const ALL_STATS_COLUMNS: (Column<CoinSummaryResponseDto> & { id: string })[] = [
  {
    Header: <ColumnVisibilityDropdown />,
    id: 'icon',
    myWidth: '35px',
    accessor: (row: CoinSummaryResponseDto) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResponseDto } }) => (
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
    id: 'coin',
    myWidth: '90px',
    accessor: (row: CoinSummaryResponseDto) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResponseDto } }) => (
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
    id: 'holdings',
    accessor: (row: CoinSummaryResponseDto) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResponseDto } }) => (
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
    id: 'costBasis',
    title: 'Cost Basis / Break Even',
    accessor: (row: CoinSummaryResponseDto) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResponseDto } }) => (
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
    id: 'currentPrice',
    myWidth: '130px',
    accessor: (row: CoinSummaryResponseDto) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResponseDto } }) => (
      <CurrentPrice coinSummary={cell.value} />
    ),
  },
  {
    Header: <DeltaHeaderMemo />,
    id: 'delta',
    myWidth: '100px',
    accessor: (row: CoinSummaryResponseDto) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResponseDto } }) => (
      <DeltaCellMemo coinSummary={cell.value} />
    ),
    Filter: () => <DeltaSelectFilterMemo />,
  },
  {
    Header: <ProfitLossHeader />,
    id: 'total',
    accessor: (row: CoinSummaryResponseDto) => row,
    Cell: ({ cell }: { cell: { value: CoinSummaryResponseDto } }) => (
      <ProfitLossCell coinSummary={cell.value} />
    ),
    Filter: () => <ProfitLossFilter />,
  },
];

export default function StatsTable() {
  const { data = EMPTY_STATS_DATA } = useCoinSummaries();
  const router = useRouter();
  const { columns } = useStatsTableContext();

  const statsColumns = useMemo(() => {
    const orderedIds = ['icon', ...columns.map(([id]) => id)];
    return orderedIds
      .map((id) => ALL_STATS_COLUMNS.find((col) => col.id === id)!)
      .filter((col) => col && (col.id === 'icon' || columns.find(([k]) => k === col.id)?.[1] !== false));
  }, [columns]);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { columns: statsColumns, data },
    useSortBy,
  );

  return (
    <div
      className="glass-card gradient-border w-full overflow-hidden"
      style={{ maxWidth: '960px', borderRadius: '12px' }}
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
          // overscrollBehavior: 'none',
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
              bgcolor: 'transparent',
              boxShadow: 'inset -1px 0 0 var(--border-subtle)',
            },
            '& thead th': {
              bgcolor: 'transparent',
              borderBottom: '1px solid var(--border-medium)',
              textAlign: 'left',
              verticalAlign: 'middle',
              color: 'var(--text-muted)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              paddingTop: '12px',
              paddingBottom: '12px',
            },
            '& tbody td': {
              textAlign: 'left',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              paddingTop: '10px',
              paddingBottom: '10px',
            },
            '& tbody tr': {
              borderBottom: '1px solid var(--border-subtle)',
              transition: 'background 0.15s ease',
            },
          }}
        >
          <thead>
            {headerGroups.map((headerGroup) => {
              const { key: headerGroupKey, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
              return (
                <tr key={headerGroupKey} {...headerGroupProps}>
                  {headerGroup.headers.map((column: any) => {
                    const { key: _colKey, ...colHeaderProps } = column.getHeaderProps();
                    return (
                      <th
                        {...colHeaderProps}
                        key={column.id}
                        style={{
                          ...(column.myWidth ? { width: column.myWidth } : { width: '110px' }),
                        }}
                      >
                        <span className="flex flex-row items-center">
                          {column.id === 'icon' ? (
                            column.render('Header')
                          ) : (
                            <>
                              <span style={{ visibility: 'hidden' }}> ▲ </span>
                              <SortArrow isSorted={column.isSorted} isSortedDesc={column.isSortedDesc}>
                                <span {...column.getSortByToggleProps()}>{column.render('Header')}</span>
                              </SortArrow>
                              {column.Filter && column.render('Filter')}
                            </>
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              );
            })}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map((row) => {
              prepareRow(row);
              const { key: rowKey, ...rowProps } = row.getRowProps();
              return (
                <tr
                  key={rowKey}
                  {...rowProps}
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
                  {row.cells.map((cell) => {
                    const { key: cellKey, ...cellProps } = cell.getCellProps();
                    return <td key={cellKey} {...cellProps}>{cell.render('Cell')}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
