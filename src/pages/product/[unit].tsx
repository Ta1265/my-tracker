import React, { useContext, useMemo } from 'react';
import { useState } from 'react';
import ProductTable from '../../components/ProductTable';
import ProductTableNew from '../../components/ProductTableNew';
import { useRouter } from 'next/router';
import PriceChart from '../../components/PriceChart';
import SingleStat from '../../components/SingleStat';
import { useGetProduct } from '../../_hooks/useGetProduct';
import RemoveIcon from '@mui/icons-material/Remove';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog';
import { useReload } from '../../context/ReloadContext';
import { SnackbarContext } from '../../context/SnackBarContext';
import { Tooltip } from '@mui/joy';

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
}

export default function Product() {
  const snackBarCtx = useContext(SnackbarContext);
  const router = useRouter();
  const unit = router.query.unit as string;
  const { transactions, isLoading } = useGetProduct(unit);
  const { triggerReload } = useReload();

  const [deleteTransactionSelection, setDeleteTransactionSelection] = useState<
    number | null
  >(null);
  const [confirmModalIsOpen, setConfirmModalIsOpen] = useState(false);

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
        Cell: ({ cell: { value } }: { cell: { value: any } }) => {
          return (
            <Tooltip title={value}>
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
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
        Cell: ({ cell: { value } }: { cell: { value: any }}) => {
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

  if (isLoading) {
    return <div></div>;
  }

  return (
    <div className="mx-auto overscroll-none h-full">
      <div>
        <PriceChart unit={unit} productFullName={transactions[0]?.fullName} />
      </div>

      <br />

      <div
        className="
        xs:max-h-[700px]
        max-h-[600px]
        scrollbar scrollbar-thin
        scrollbar-track-transparent

        scrollbar-thumb-gray-400
        dark:text-gray-400
        sm:max-h-[600px]
        lg:max-h-[500px]
        xl:max-h-[400px]
      "
        style={{
          minWidth: '899px',
          maxWidth: '899px',
          overflowY: 'scroll',
          overflowX: 'auto',
        }}
      >
        <ProductTableNew columns={productColumns} data={transactions} />
      </div>

      <ConfirmDeleteDialog
        isOpen={confirmModalIsOpen}
        setIsOpen={setConfirmModalIsOpen}
        onConfirm={async () => {
          if (deleteTransactionSelection !== null) {
            deleteTransaction(deleteTransactionSelection).then(triggerReload);
            snackBarCtx.toastSuccess({ message: 'Transaction deleted' });
          }
        }}
      />
    </div>
  );
}
