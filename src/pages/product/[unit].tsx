import React, { useContext, useMemo } from 'react';
import { useState } from 'react';
import ProductTable from '../../components/ProductTable';
import { useRouter } from 'next/router';
import PriceChart from '../../components/PriceChart';
import RemoveIcon from '@mui/icons-material/Remove';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog';
import { useReload } from '../../context/ReloadContext';
import { SnackbarContext } from '../../context/SnackBarContext';
import Tooltip from '@mui/joy/Tooltip';
import { useMutation, useQuery } from '@tanstack/react-query';

const sortDollars = (rowA: any, rowB: any, columnId: string) => {
  const aNum = parseFloat(rowA.values[columnId].replace(/[$,]/g, ''));
  const bNum = parseFloat(rowB.values[columnId].replace(/[$,]/g, ''));
  return aNum - bNum;
};

const deleteTransaction = async (id: number) => {
  await fetch(`/api/transaction/${id}`, {
    method: 'DELETE',
  })
    .then((resp) => {
      if (resp.status === 204) {
        console.log('success');
      }
    })
    .then((error) => {
      console.log('error', error);
    });
};

export default function Product() {
  const [deleteTransactionSelection, setDeleteTransactionSelection] = useState<number | null>(null);
  const { triggerReload } = useReload();
  const [confirmModalIsOpen, setConfirmModalIsOpen] = useState(false);
  const snackBarCtx = useContext(SnackbarContext);
  const router = useRouter();

  const query = useQuery({
    queryKey: ['product', router.query.unit],
    queryFn: async () =>
      fetch(`/api/product/${router.query.unit}`).then((res) => {
        if (!res.ok) {
          throw new Error('Network response error');
        }
        return res.json();
      }),
    enabled: router.isReady, // only fetch when the router is ready
  });

  // const { mutate: deleteTransactionMutate } = useMutation(
  //   () => {
  //     if (deleteTransactionSelection) {
  //       return deleteTransaction(deleteTransactionSelection);
  //     }
  //     return;
  //   },
  //   {
  //     onSuccess: () => {
  //       query.refetch();
  //       snackBarCtx.toastSuccess({ message: 'Transaction deleted' });
  //     },
  //   },
  // );


  const productFullName = query.data?.[0]?.fullName;

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
    [],
  );

  if (query.isPending) {
    return <div></div>;
  }

  return (
    <div
      className="
        mx-auto 
        h-full 
        w-full 
        overflow-auto
        scrollbar
        scrollbar-thin
        scrollbar-track-transparent
        scrollbar-thumb-gray-700
      "
    >
      <div
        className="
        mx-auto 
        h-full 
        w-full 
      "
        style={{ maxWidth: '910px' }}
      >
        <div className="mx-auto w-full" style={{ maxWidth: '900px' }}>
          <PriceChart unit={router.query.unit as string} productFullName={productFullName} />
        </div>

        <br />
        <ProductTable columns={productColumns} data={query.data || []}/>

        <ConfirmDeleteDialog
          isOpen={confirmModalIsOpen}
          setIsOpen={setConfirmModalIsOpen}
          onConfirm={async () => {
            if (deleteTransactionSelection !== null) {
              // deleteTransactionMutate(deleteTransactionSelection);
              deleteTransaction(deleteTransactionSelection).then(triggerReload);
              // snackBarCtx.toastSuccess({ message: 'Transaction deleted' });
            }
          }}
        />
      </div>
    </div>
  );
}
