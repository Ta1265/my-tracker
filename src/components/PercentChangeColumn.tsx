import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import { useQuery } from '@tanstack/react-query';
import type { CoinSummaryResp } from '../../types/global';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import { usePriceFeed } from '../context/CoinbaseWsFeedContext';
import TickerDisplay from './TickerDisplay';
import Box from '@mui/material/Box';


interface PriceResp {
  prices: number[][];
  price_change: number;
  usd_price_change: number;
}

const PercentChangeCell:React.FC<{
  coinSummary: CoinSummaryResp;
  selectedTimeFrame: TimeFrame;
}> = ({
  coinSummary,
  selectedTimeFrame,
}) => {
  const { coinName, productName: unit, currentPrice, holdings } = coinSummary;

  const { 
    data, 
    isPending,
    isError,
    error,
    isRefetching,
  } = useQuery<PriceResp>({
    queryKey: ['price', coinName, selectedTimeFrame],
    queryFn: async ({ signal }): Promise<PriceResp> => {
      const resp = await fetch(
        `https://price-api.crypto.com/price/v2/${selectedTimeFrame}/${coinName.toLowerCase()}`,
        { signal },
      );
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
    // refetchOnWindowFocus: 'always',
  });


  const { price: priceFeed } = usePriceFeed(`${unit}-USD`);
  const timeFrameStartPrice = data?.prices[0][1] || 0;

  const prevValue = timeFrameStartPrice;
  const curValue = priceFeed || currentPrice;

  const priceDiff = (curValue - timeFrameStartPrice);

  const priceChange = priceDiff;

  // const [price, setPrice] = useState<number | null>(null);

  // useEffect(() => {
  //   if (cbWs) {
  //     cbWs.addSubscription(unit, (data) => {
  //       setPrice(data.price)
  //     })
  //   }
  // }, []);

  const isLoading = isPending || isRefetching;

  // const priceChange = data?.price_change;

  if (isError) {
    console.error(error);
    return <div className="text-center">Error</div>;
  }

  const color = priceChange && priceChange < 0 ? '#F0616D' : '#27AD75';
  const arrow = priceChange && priceChange > 0 ? '▲ ' : '▼ ';
  const percentage = priceChange && (priceChange * 100).toFixed(2) + '%';

  return (
    <Box className="text-left" style={{ color, fontFamily: 'Roboto Mono, monospace' }}>
      <Skeleton variant="rectangular" overlay={true} loading={isLoading}>
        <span>{arrow}</span>
        <TickerDisplay cur={priceChange} format={'USD'} showArrow={false} />
        <br></br>
        <span style={{
          visibility: 'hidden',
        }}>{arrow}</span>
        <TickerDisplay
          cur={(priceChange / curValue) * 100}
          format={'PERCENTAGE'}
          showArrow={false}
        />
        {/* <span className="">
          {/* {price} */}
        {/* {arrow} {percentage} */}
        {/* </span> */}
      </Skeleton>
    </Box>
  );
};


export const PercentChangeFilter: React.FC<{
  setSelectedTimeFrame: React.Dispatch<React.SetStateAction<TimeFrame>>;
  selectedTimeFrame: TimeFrame;
}> = ({
  setSelectedTimeFrame,
  selectedTimeFrame,
}) => {

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center !important',
      }}
    >
      <Select
        className="uppercase dark:text-gray-400"
        onChange={(
          event: React.SyntheticEvent | null,
          newValue: 'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all' | null,
        ) => {
          if (newValue) {
            setSelectedTimeFrame(newValue);
          }
        }}
        defaultValue={selectedTimeFrame}
        renderValue={() => ``}
        sx={{
          border: 0,
          textAlign: 'center',
          fontSize: 'inherit',
          backgroundColor: 'inherit',
          '&:hover': {
            backgroundColor: 'inherit',
          }
        }}
      >
        <Option value="h">HOUR</Option>
        <Option value="d">DAY</Option>
        <Option value="w">WEEK</Option>
        <Option value="m">1 M</Option>
        <Option value="3m">3 M</Option>
        <Option value="6m">6 M</Option>
        <Option value="y">1 Y</Option>
        <Option value="all">ALL</Option>
      </Select>
    </div>
  );
};

export const PercentChangeCellMemo = React.memo(PercentChangeCell)
export const PercentChangeFilterMemo = React.memo(PercentChangeFilter)

