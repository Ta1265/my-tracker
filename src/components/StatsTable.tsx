/* eslint-disable react/jsx-key */
import React, { useEffect } from 'react';
import { useState } from 'react';
import { useTable, useSortBy } from 'react-table';
import { useRouter } from 'next/router';

type DataType = {
  [key: string]: any;
};

interface TableProps {
  columns: Column<DataType>[];
  data: DataType[];
}

const StatsTable: React.FC<TableProps> = ({ columns, data }) => {
  const router = useRouter();
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data }, useSortBy);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <table
      {...getTableProps()}
      className="table-fixed text-left text-gray-500 dark:text-gray-400"
      style={{
        width: '100%',
      }}
    >
      <thead
        className="
            whitespace-nowrap
            bg-gray-50
            uppercase
            text-gray-700
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
            {...headerGroup.getHeaderGroupProps()}
            style={{
              boxShadow: 'inset 0px -2px grey, inset 0px 2px grey',
              zIndex: 100,
            }}
          >
            {headerGroup.headers.map((column, columnIndex) => {
              if (column.Filter) {
                return (
                  <th
                    scope="col"
                    className="py-3 text-center"
                    style={{
                      borderTop: '0px',
                      border: 'none',
                      zIndex: 100,
                    }}
                  >
                    {/* <div className="relative text-center">
                      <div className="absolute text-center"> */}
                    {column.render('Header')}
                    {/* </div> */}
                    {column.render('Filter')}
                    {/* </div> */}
                  </th>
                );
              }
              return (
                <th
                  scope="col"
                  className="py-3 text-center"
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
                  border-b-[0.75px]
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
                        py-8
                        text-center
                        text-2xl
                        text-xl
                        transition-opacity
                        duration-500
                        md:py-5
                        md:text-base
                        lg:text-lg
                        xl:px-6
                        ${loaded ? 'opacity-100' : 'opacity-0'}
                      `}
                    style={{
                      transitionDelay: `${rowIndex * 0.05}s`,
                      ...(cellIndex === 0 && {
                        position: 'sticky',
                        left: 0,
                        zIndex: 150,
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
    </table>
  );
};

export default StatsTable; /* eslint-disable react/jsx-key */
