// import React, { createContext, useContext, useState } from 'react';
// import { type TimeFrame } from '../components/product/TimeFrameSelect';
// import { useQuery } from '@tanstack/react-query';
// import { usePriceFeed } from './CoinbaseWsFeedContext';
// import { type CoinSummaryResp, type PriceHistoryResp } from '../../types/global';

// interface PriceHistoryContextProps {
//   timeFrame: TimeFrame;
//   setTimeFrame: React.Dispatch<React.SetStateAction<TimeFrame>>;
//   priceData: PriceHistoryResp['prices'] | [[]];
//   priceChange: number;
//   startPrice: number;
//   priceHistoryLoading: boolean;
//   coinName: string;
//   unit: string;
//   priceFeed: number | null;
// }


// const SummaryContext = createContext<PriceHistoryContextProps | undefined>(undefined);

// export const SummaryProvider: React.FC<{
//   children: React.ReactNode;
//   coinName: string;
//   unit: string;
// }> = ({ children, coinName, unit }) => {
//   const [timeFrame, setTimeFrame] = useState<TimeFrame>('d');
//   const [CoinSummaries, setCoinSummaries] = useState<CoinSummaryResp[]>([]);

//   // const {
//   //   data,
//   // } = useQuery({
//   //   queryKey: ['summary', 'all-coins'],
//   //   queryFn: async ({ signal }): Promise<CoinSummaryResp[]> => {
//   //     const resp = await fetch(`/api/summary/coins`, { signal });
//   //     if (!resp.ok) {
//   //       throw new Error('Network response error');
//   //     }
//   //     return resp.json();
//   //   },
//   //   onSuccess: (data) => {
//   //     setCoinSummaries(data);
//   //   }

//   // });

//   // const { data, isLoading: priceHistoryLoading } = useQuery({
//   //   queryKey: ['price-hist', coinName, timeFrame],
//   //   queryFn: async ({ signal }): Promise<PriceHistoryResp> =>
//   //     fetch(`https://price-api.crypto.com/price/v2/${timeFrame}/${coinName.toLowerCase()}`, {
//   //       signal,
//   //     }).then(async (res) => {
//   //       if (!res.ok) {
//   //         throw new Error('Network response error');
//   //       }
//   //       return res.json();
//   //     }),
//   // });

//   const { price_change, prices } = data || {};

//   const priceData = React.useMemo(() => prices || [[]], [prices]) as PriceHistoryResp['prices'];
//   const priceChange = React.useMemo(() => price_change || 0, [price_change]);
//   const startPrice = React.useMemo(() => priceData[0][1] || 0, [priceData]);

//   // const priceData = data?.prices || [[]];
//   // const priceChange = data?.price_change || 0;
//   // const startPrice = priceData[0][1] || 0;

//   return (
//     <PriceHistoryContext.Provider
//       value={{
//         timeFrame,
//         setTimeFrame,
//         hoveringChart,
//         setHoveringChart,
//         hoverPrice,
//         setHoverPrice,
//         priceData,
//         priceChange,
//         startPrice,
//         priceHistoryLoading,
//         coinName,
//         unit,
//         priceFeed,
//       }}
//     >
//       {children}
//     </PriceHistoryContext.Provider>
//   );
// };

// export const usePriceHistory = (): PriceHistoryContextProps => {
//   const context = useContext(PriceHistoryContext);
//   if (!context) {
//     throw new Error('usePriceChart must be used within a PriceChartProvider');
//   }
//   return context;
// };