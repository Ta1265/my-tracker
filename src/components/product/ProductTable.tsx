/* eslint-disable react/jsx-key */
import React, { useMemo } from 'react';
import { useRef, useState, useEffect } from 'react';
import { useTable, Column, useSortBy } from 'react-table';
import Table from '@mui/joy/Table';
import SortArrow from '../SortArrow';
import Tooltip from '@mui/joy/Tooltip';
import RemoveIcon from '@mui/icons-material/Remove';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';

const sortDollars = (rowA: any, rowB: any, columnId: string) => {
  const aNum = parseFloat(rowA.values[columnId].replace(/[$,]/g, ''));
  const bNum = parseFloat(rowB.values[columnId].replace(/[$,]/g, ''));
  return aNum - bNum;
};

type DataType = {
  [key: string]: any;
};

interface Props {
  setDeleteTransactionSelection: React.Dispatch<React.SetStateAction<number | null>>;
  setConfirmModalIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  unit: string;
}

const ProductTable: React.FC<Props> = ({ unit, setDeleteTransactionSelection, setConfirmModalIsOpen }) => {
  const [loaded, setLoaded] = useState(false);

  const query = useQuery({
    queryKey: ['product', unit],
    queryFn: async () =>
      fetch(`/api/product/${unit}`).then((res) => {
        if (!res.ok) {
          throw new Error('Network response error');
        }
        return res.json();
      }),
  });

  const columns = useMemo(
    () => [
      {
        Header: 'Date',
        accessor: 'date',
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const dateA = new Date(rowA.values[columnId]).getTime();
          const dateB = new Date(rowB.values[columnId]).getTime();
          return dateA - dateB;
        },
        Cell: ({ cell: { value } }: { cell: { value: any } }) => {
          return (
            <Tooltip title={value}>
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {new Date(value).toLocaleDateString()}
              </div>
            </Tooltip>
          );
        },
      },
      {
        Header: 'Side',
        accessor: 'side',
        // myWidth: '5%',
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const a = rowA.values[columnId];
          const b = rowB.values[columnId];
          return a > b ? 1 : -1;
        },
        Cell: ({ cell: { value } }: { cell: { value: any } }) => {
          return <div style={{ color: value === 'BUY' ? '#27AD75' : '#F0616D' }}>{value}</div>;
        },
      },
      {
        Header: 'size',
        accessor: 'size',
      },
      {
        Header: 'Price',
        accessor: 'price',
        sortType: sortDollars,
      },
      {
        Header: 'Fee',
        accessor: 'fee',
        sortType: sortDollars,
        // myWidth: '5%'
      },
      {
        Header: 'Total',
        accessor: 'total',
        sortType: sortDollars,
      },
      {
        Header: 'Notes',
        accessor: 'notes',
        sortType: (rowA: any, rowB: any, columnId: string): any => {
          const a = rowA.values[columnId];
          const b = rowB.values[columnId];
          return a > b ? 1 : -1;
        },
        Cell: ({ cell: { value } }: { cell: { value: any } }) => {
          return (
            <Tooltip title={value}>
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {value}
              </div>
            </Tooltip>
          );
        },
      },
      {
        Header: '',
        accessor: 'id',
        myWidth: '5%',
        Cell: ({ cell: { value } }: { cell: { value: any } }) => {
          return (
            <Tooltip title="Delete transaction">
              <RemoveIcon
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setConfirmModalIsOpen(true);
                  setDeleteTransactionSelection(value);
                }}
              />
            </Tooltip>
          );
        },
      },
    ],
    [setDeleteTransactionSelection, setConfirmModalIsOpen],
  );

  useEffect(() => {
    setLoaded(true);

    return () => setLoaded(false);
  }, []);

  return <TableComponent
    columns={columns}
    data={query.data || []}
    loaded={loaded && query.isSuccess}
   />;
};

interface TableComponentProps {
  columns: Column<DataType>[];
  data: DataType[];
  loaded: boolean;
}

function TableComponent({ columns, data, loaded }: TableComponentProps) {
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { columns, data },
    useSortBy,
  );

  const [screenWidth, setScreenWidth] = useState<number | null>(null);

  useEffect(() => {
    setScreenWidth(window.innerWidth);
  }, []);

  return (
    <div
      className="
         w-full
         overflow-auto
         scrollbar
         scrollbar-thin
         scrollbar-track-transparent
         scrollbar-thumb-gray-700
       "
      style={{
        maxWidth: '900px',
        overscrollBehavior: 'none'// !important',
      }}
    >
      <Table
        {...getTableProps()}
        className=""
        style={{
          maxWidth: '900px',
          minWidth: '880px',
          overscrollBehavior: 'none'// !important',
        }}
        variant="plain"
        size={screenWidth && screenWidth < 768 ? 'sm' : 'md'}
        stickyHeader={true}
        sx={{
          '& thead th': {
            borderBottomWidth: '3px',
            backgroundColor: '#000',
          },
        }}
      >
        <thead
          className="
            py-1
            uppercase
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
                      dark:text-gray-400
                    "
                    {...column.getHeaderProps(column.getSortByToggleProps())}
                    style={{
                      top: '-1px', // prevent rows peeking above sticky header
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      ...(column.myWidth && { width: column.myWidth }),
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
}

export default ProductTable;
