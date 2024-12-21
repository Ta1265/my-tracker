import React from 'react';
import Box from '@mui/material/Box';
import { usePriceFeed } from '../../context/CoinbaseWsFeedContext';
import TickerDisplay from '../TickerDisplay';
import { type CoinSummaryResp } from '../../../types/global';
import Skeleton from '@mui/joy/Skeleton';
import { useStatsTableContext } from '../../context/StatsTableContext';

const CurrentPrice: React.FC<{
  coinSummary: CoinSummaryResp;
}> = ({ 
  coinSummary, 
 }) => {
  const { productName: unit, currentPrice: backupCurrenPrice } = coinSummary;
  const {
    timeFrameCoinsPl,
    timeFrameCoinsPlIsLoading: isPending,
  } = useStatsTableContext();

  const timeFrameStartPrice = timeFrameCoinsPl?.[unit]?.timeFrameStartPrice || 0;

  const { price: priceFeed } = usePriceFeed(`${unit}-USD`);

  const curPrice = priceFeed || backupCurrenPrice;

  const priceChange = (curPrice - timeFrameStartPrice);

  const isLoading = isPending;

  const color = priceChange && priceChange < 0 ? '#F0616D' : '#27AD75';
  const arrow = priceChange && priceChange > 0 ? '▲ ' : '▼ ';

  return (
    <>
      <Box className="text-left ticker">
        <Skeleton variant="rectangular" overlay={true} loading={isLoading}>
          <TickerDisplay value={curPrice} format={'USD'} showArrow />
          <br></br>
          <span style={{ visibility: 'hidden' }}>
            {arrow}
          </span>
          <span style={{ color }} className="text-light text-xs">
            <TickerDisplay value={priceChange} format={'USD'} fracDigits={2} />
            {' ('}<TickerDisplay value={(priceChange / timeFrameStartPrice) * 100} format={'PERCENTAGE'} fracDigits={2} />{')'}
          </span>
        </Skeleton>
      </Box>
    </>
  );
};

export default CurrentPrice;