/* eslint-disable react/jsx-key */
import React, { useMemo } from 'react';
import { useRef, useState, useEffect } from 'react';
import { useTable, Column, useSortBy } from 'react-table';

type DataType = {
  [key: string]: any;
};

interface TableProps {
  columns: Column<DataType>[];
  data: DataType[];
}

const ProductTable: React.FC<TableProps> = ({ columns, data }) => {
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data }, useSortBy);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);

    return () => setLoaded(false);
  }, []);

  return (
    <div
      className="
        xs:max-h-[700px]
        max-h-[800px]
        scrollbar scrollbar-thin
        scrollbar-track-transparent

        scrollbar-thumb-gray-400
        dark:text-gray-400
        sm:max-h-[600px]
        lg:max-h-[500px]
        xl:max-h-[400px]
      "
      style={{
        top: 0,
        maxWidth: '1440px',
        overflowY: 'scroll',
        overflowX: 'auto',
      }}
    >
      <table
        {...getTableProps()}
        className="text-left text-sm text-gray-500 dark:text-gray-400"
        style={{
          width: '100%',
        }}
      >
        <thead
          className="
            bg-gray-50
            py-1
            text-sm
            uppercase
            text-white
            dark:bg-black
            dark:text-gray-400
          "
          style={{
            borderTop: '0px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {headerGroups.map((headerGroup) => (
            <tr
              id="product-header-row"
              className=""
              {...headerGroup.getHeaderGroupProps()}
              style={{
                boxShadow: 'inset 0px -2px grey, inset 0px 2px grey',
                zIndex: 100,
              }}
            >
              {headerGroup.headers.map((column, index) => (
                <th
                  scope="col"
                  className="
                    px-6
                    py-3
                    text-center
                  "
                  {...column.getHeaderProps(column.getSortByToggleProps())}
                  style={{
                    borderTop: '0px',
                    border: 'none',
                    zIndex: 100,
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
              ))}
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
                border-b-[0.75px]
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
                      px-6
                      py-4
                      text-center
                      transition-opacity
                      duration-500
                      ${loaded ? 'opacity-100' : 'opacity-0'}
                    `}
                    style={{
                      transitionDelay: `${rowIndex * 0.05}s`,
                      zIndex: 49,
                    }}
                  >
                    {cell.render('Cell')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable; /* eslint-disable react/jsx-key */
