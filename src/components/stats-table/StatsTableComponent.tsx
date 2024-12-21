/* eslint-disable react/jsx-key */
import { useTable, useSortBy } from 'react-table';
import type { Column } from 'react-table';
import React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Table from '@mui/joy/Table';
import SortArrow from '../SortArrow';
import type { CoinSummaryResp } from '../../../types/global';

interface TableComponentProps {
  data: CoinSummaryResp[];
  columns: Column<CoinSummaryResp>[];
}

export default function StatsTableComponent({ data, columns}: TableComponentProps) {
  const router = useRouter();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { columns, data },
    useSortBy,
  );

  const [loaded, setLoaded] = useState(false);

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
            width: '110px',
          },
          '& thead th': {
            bgcolor: '#000',
            borderBottomWidth: '3px',
            textAlign: 'left',
            verticalAlign: 'middle',
            width: '110px',
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
                <th
                  className="dark:text-gray-400"
                  {...column.getHeaderProps()}
                  key={column.id}
                  style={{
                    ...(column.myWidth ? { width: column.myWidth } : {}),
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
                    router.push({
                      pathname: `/product`,
                      query: {
                        unit: row.original.productName,
                        name: row.original.coinName,
                      },
                    });
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