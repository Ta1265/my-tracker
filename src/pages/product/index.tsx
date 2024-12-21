import React from 'react';
import { useState } from 'react';
import ProductTable from '../../components/product/ProductTable';
import { useRouter } from 'next/router';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog';
import { useReload } from '../../context/ReloadContext';
import { SnackbarContext } from '../../context/SnackBarContext';
import { PriceHistoryProvider } from '../../context/PriceHistoryProvider';
import SingleStat from '../../components/SingleStat';
import Box from '@mui/material/Box';
import { LineChart } from '../../components/product/LineChart';
import { TimeFrameSelect } from '../../components/product/TimeFrameSelect';
import { TitleAndPriceDisplay } from '../../components/product/TitleAndPriceDisplay';

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
  const router = useRouter();
  const [deleteTransactionSelection, setDeleteTransactionSelection] = useState<number | null>(null);
  const { triggerReload } = useReload();
  const [confirmModalIsOpen, setConfirmModalIsOpen] = useState(false);
  const snackBarCtx = React.useContext(SnackbarContext);

  const unit = router.query.unit as string;
  const productFullName = router.query.name as string;

  if (!router.isReady || !unit || !productFullName) {
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
      <div className="mx-auto h-full w-full" style={{ maxWidth: '910px' }}>
        <PriceHistoryProvider coinName={productFullName} unit={unit}>
          <div className="mx-auto w-full" style={{ maxWidth: '900px' }}>
            <div className="flex py-2">
              <TitleAndPriceDisplay />
              <div className="flex-grow text-center">
                <TimeFrameSelect />
              </div>
            </div>

            <Box
              className="mx-auto flex w-full items-center justify-center"
              style={{ touchAction: 'none', maxHeight: '450px' }}
            >
              <LineChart />
            </Box>

            <br />

            <SingleStat />
          </div>

          <br />
          <ProductTable
            unit={unit}
            setConfirmModalIsOpen={setConfirmModalIsOpen}
            setDeleteTransactionSelection={setDeleteTransactionSelection}
          />
        </PriceHistoryProvider>
        
        <ConfirmDeleteDialog
          isOpen={confirmModalIsOpen}
          setIsOpen={setConfirmModalIsOpen}
          onConfirm={() => {
            if (deleteTransactionSelection !== null) {
              // deleteTransactionMutate(deleteTransactionSelection);
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
