
/* eslint-disable react/jsx-key */
import React, { useMemo } from 'react';
import { useRef, useState, useEffect } from 'react';
import { useTable, Column, useSortBy } from 'react-table';
import AddTransaction from './AddTransaction';
import Table from '@mui/joy/Table';

type DataType = {
  [key: string]: any;
};

interface TableProps {
  columns: Column<DataType>[];
  data: DataType[];
}

const ProductTableNew: React.FC<TableProps> = ({ columns, data }) => {
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data }, useSortBy);

  const [loaded, setLoaded] = useState(false);
  
  const [screenWidth, setScreenWidth] = useState<number | null>(null);

  useEffect(() => {
    setScreenWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    setLoaded(true);

    return () => setLoaded(false);
  }, []);

  return (
    // <div
    //   className="
    //     xs:max-h-[700px]
    //     h-full
    //     max-h-[600px] scrollbar
    //     scrollbar-thin
    //     scrollbar-track-transparent
    //     scrollbar-thumb-gray-400
    //     dark:text-gray-400
    //   "
    //   style={{
    //     minWidth: '100%',
    //     maxWidth: '899px',
    //     overflowY: 'scroll',
    //     overflowX: 'scroll',
    //   }}
    // >
    <div
      className="
         max-h-full
         lg:max-h-[300px]
         w-full
         lg:overflow-x-auto
         overflow-y-auto
         scrollbar
         scrollbar-thin
         scrollbar-track-transparent
         scrollbar-thumb-gray-400
         dark:text-gray-400
       "
      style={{
        maxWidth: '900px',
      }}
    >
      <Table
        {...getTableProps()}
        className=""
        style={{
          maxWidth: '100%',
          minWidth: '880px',
        }}
        variant="plain"
        size={screenWidth < 768 ? 'sm' : 'lg'}
        stickyHeader={true}
      >
        <thead
          className="
            bg-gray-50
            py-1
            uppercase
            text-white
            dark:bg-black
            dark:text-gray-400
          "
        >
          {headerGroups.map((headerGroup) => (
            <tr id="product-header-row" {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column, index) => {
                return (
                  <th
                    scope="col"
                    className="
                      py-1
                      text-center
                    "
                    {...column.getHeaderProps(column.getSortByToggleProps())}
                    style={{
                      top: '-1px', // prevent rows peeking above sticky header
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      ...(column.myWidth && { width: column.myWidth }),
                    }}
                  >
                    {column.render('Header')}
                    <span>
                      {column.isSorted
                        ? column.isSortedDesc
                          ? ' 🔽'
                          : ' 🔼'
                        : ''}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()} className="border-border">
          {rows.map((row, rowIndex) => {
            prepareRow(row);
            return (
              <tr
                id="transaction-row"
                {...row.getRowProps()}
                className={`
                ease-in-out-out
                transform
                border-gray-800
                transition-transform
                duration-500
                ${loaded ? 'translate-y-0' : '-translate-y-5'}
              `}
                style={{
                  transitionDelay: `${rowIndex * 0.005}s`,
                }}
              >
                {row.cells.map((cell, index) => (
                  <td
                    {...cell.getCellProps()}
                    className={`
                      text-center
                      transition-opacity
                      duration-500
                      ${loaded ? 'opacity-100' : 'opacity-0'}
                    `}
                    style={{
                      transitionDelay: `${rowIndex * 0.05}s`,
                      textAlign: 'center',
                    }}
                  >
                    {cell.render('Cell')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
};

export default ProductTableNew; /* eslint-disable react/jsx-key */
