import { useEffect, useState } from 'react';
import { useReload } from '../context/ReloadContext';

export const useGetProduct = (selectedProductName: String | null) => {
  const { reload } = useReload();
  const [transactions, setTransactions] = useState<Array<Transaction>>([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedProductName) return;
    setLoading(true);
    fetch(`/api/product/${selectedProductName}`)
      .then((res) => res?.json())
      .then((resp: Array<Transaction>) => {
        console.log('got resp', resp);
        setTransactions(resp);
        setLoading(false);
      });
  }, [selectedProductName, reload]);

  return { transactions, isLoading };
};