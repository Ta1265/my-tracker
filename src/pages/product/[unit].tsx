import React, { useEffect, useMemo } from 'react';
import { useState } from 'react';
import ProductTable from '../_components/ProductTable';
import { useRouter } from 'next/router';
import Link from 'next/link';
import PriceChart from '../_components/PriceChart';
import SingleStat from '../_components/SingleStat';
import { Spinner } from 'flowbite-react';

const sortDollars = (rowA: any, rowB: any, columnId: string) => {
  const aNum = parseFloat(rowA.values[columnId].replace(/[$,]/g, ''));
  const bNum = parseFloat(rowB.values[columnId].replace(/[$,]/g, ''));
  return aNum - bNum;
};

const useGetProduct = (selectedProductName: String | null) => {
  const [transactions, setTransactions] = useState<Array<Transaction>>([]);
  const [isLoading, setLoading] = useState(true);

  console.log('hello????????', selectedProductName)
  useEffect(() => {
    if (!selectedProductName) return;
    setLoading(true);
    fetch(`/api/product/${selectedProductName}`)
      .then((res) => res.json())
      .then((resp: Array<Transaction>) => {
        console.log('got resp', resp);
        setTransactions(resp);
        setLoading(false);
      });
  }, [selectedProductName]);

  return { transactions, isLoading };
};

export default function Product() {
  const router = useRouter();
  const unit = router.query.unit as string;
  const { transactions, isLoading } = useGetProduct(unit);
  const productColumns = useMemo(
    () => [
      {
        Header: 'Date',
        accessor: 'date',
        sortType: (rowA: any, rowB: any, columnId: any) => {
          const dateA = new Date(rowA.values[columnId]).getTime();
          const dateB = new Date(rowB.values[columnId]).getTime();
          return dateA - dateB;
        },
      },
      {
        Header: 'Side',
        accessor: 'side',
        sortType: (rowA, rowB, columnId) => {
          const a = rowA.values[columnId];
          const b = rowB.values[columnId];
          return a > b ? 1 : -1;
        },
        Cell: ({ cell: { value } }: { cell: { value: any } }) => {
          return (
            <div style={{ color: value === 'BUY' ? '#27AD75' : '#F0616D' }}>
              {value}
            </div>
          );
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
      },
      {
        Header: 'Total',
        accessor: 'total',
        sortType: sortDollars,
      },
      {
        Header: 'Notes',
        accessor: 'notes',
        sortType: (rowA, rowB, columnId: string): any => {
          const a = rowA.values[columnId];
          const b = rowB.values[columnId];
          return a > b ? 1 : -1;
        },
      },
    ],
    [],
  );

  if (isLoading) {
    return <div></div>;
  }

  return (
    <>
      <div>
        <PriceChart unit={unit} productFullName={transactions[0]?.fullName} />
      </div>

      <br />

      <ProductTable columns={productColumns} data={transactions} />
    </>
  );
}
