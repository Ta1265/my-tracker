/* eslint-disable react/jsx-key */
import { useTable, useSortBy, Column } from 'react-table';
import React, { useEffect } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Table from '@mui/joy/Table';
import SortArrow from './SortArrow';

type DataType = {
  [key: string]: any;
};

interface TableProps {
  columns: Column<DataType>[];
  data: DataType[];
}

const StatsTableNewest: React.FC<TableProps> = ({ columns, data }) => {
  const router = useRouter();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data }, useSortBy);

  const [loaded, setLoaded] = useState(false);

  const [screenWidth, setScreenWidth] = useState<number | null>(null);

  useEffect(() => {
    setScreenWidth(window.innerWidth);
  }, []);

  useEffect(() => {
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
                        width:
                          screenWidth && screenWidth < 768 ? '80px' : '120px',
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
                    className="dark:text-gray-400"
                    style={{
                      ...(columnIndex === 0 && {
                        position: 'sticky',
                        left: '0px',
                        zIndex: 53,
                      }),
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      width:
                        screenWidth && screenWidth < 768 ? '100px' : '128px',
                      paddingLeft: '5px',
                      paddingRight: '5px',
                    }}
                  >
                    <SortArrow
                      isSorted={column.isSorted}
                      isSortedDesc={column.isSortedDesc}
                    >
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

export default StatsTableNewest;
