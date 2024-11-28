
import React, { useMemo, useEffect, useState } from 'react';

export const useGetTokenList = () => {
  const [coinSearchValue, setCoinSearchValue] = useState('');
  const [coinList, setCoinList] = useState<
    Array<{
      unit: string;
      label: string;
      value: { unit: string; name: string; token_id: number };
    }>
  >([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    if (!coinSearchValue.length) {
      return;
    }
    setLoading(true);

    fetch(`/api/token-info/search/${coinSearchValue}`)
      .then((res) => res?.json())
      .then((resp: { symbol: string; name: string; token_id: number }) => {
        if (!Array.isArray(resp)) {
          return;
        }
        setCoinList(
          resp.map((token) => ({
            unit: token.symbol,
            label: `${token.name} (${token.symbol})`,
            value: {
              unit: token.symbol,
              name: token.name,
              token_id: token.token_id,
            },
          })),
        );
        setLoading(false);
      });
  }, [coinSearchValue]);

  const coinOptions = coinList;
  return { coinOptions, isLoading, setCoinSearchValue, coinSearchValue };
};
