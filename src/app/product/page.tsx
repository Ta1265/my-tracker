'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductTable from '@/components/product/ProductTable';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useReload } from '@/context/ReloadContext';
import { SnackbarContext } from '@/context/SnackBarContext';
import { PriceHistoryProvider } from '@/context/PriceHistoryProvider';
import SingleStat from '@/components/SingleStat';
import Box from '@mui/material/Box';
import { LineChart } from '@/components/product/LineChart';
import { TimeFrameSelect } from '@/components/product/TimeFrameSelect';
import { TitleAndPriceDisplay } from '@/components/product/TitleAndPriceDisplay';

const deleteTransaction = async (id: number) => {
  await fetch(`/api/transaction/${id}`, { method: 'DELETE' })
    .then((resp) => {
      if (resp.status === 204) console.log('success');
    })
    .catch((error) => console.log('error', error));
};

export default function Product() {
  const searchParams = useSearchParams();
  const unit = searchParams?.get('unit') as string;
  const productFullName = searchParams?.get('name') as string;

  const [deleteTransactionSelection, setDeleteTransactionSelection] = useState<number | null>(null);
  const { triggerReload } = useReload();
  const [confirmModalIsOpen, setConfirmModalIsOpen] = useState(false);
  const snackBarCtx = React.useContext(SnackbarContext);

  if (!unit || !productFullName) {
    return <div></div>;
  }

  return (
    <div
      className="mx-auto h-full w-full overflow-auto scrollbar scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700"
      style={{ maxWidth: '960px' }}
    >
      <div className="mx-auto h-full w-full px-2" style={{ maxWidth: '960px' }}>
        <PriceHistoryProvider coinName={productFullName} unit={unit}>
          <div
            className="glass-card gradient-border mx-auto mt-4 w-full overflow-hidden"
            style={{ padding: '16px 12px 8px' }}
          >
            <div className="flex items-center py-2 px-2">
              <TitleAndPriceDisplay />
              <div className="ml-auto">
                <TimeFrameSelect />
              </div>
            </div>
            <Box
              className="mx-auto flex w-full items-center justify-center"
              style={{ touchAction: 'none', maxHeight: '450px' }}
            >
              <LineChart />
            </Box>
          </div>
          <div
            className="glass-card gradient-border mx-auto mt-4 w-full"
            style={{ padding: '16px' }}
          >
            <SingleStat />
          </div>
          <div className="glass-card gradient-border mt-4 mx-2 overflow-hidden">
            <ProductTable
              unit={unit}
              setConfirmModalIsOpen={setConfirmModalIsOpen}
              setDeleteTransactionSelection={setDeleteTransactionSelection}
            />
          </div>
        </PriceHistoryProvider>
        <ConfirmDeleteDialog
          isOpen={confirmModalIsOpen}
          setIsOpen={setConfirmModalIsOpen}
          onConfirm={() => {
            if (deleteTransactionSelection !== null) {
              deleteTransaction(deleteTransactionSelection).then(() => {
                snackBarCtx.toastSuccess({ message: 'Transaction deleted' });
                triggerReload();
              });
            }
          }}
        />
      </div>
    </div>
  );
}
