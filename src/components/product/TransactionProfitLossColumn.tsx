import React from 'react';
import { usePriceHistory } from '../../context/PriceHistoryProvider';
import Box from '@mui/material/Box';
import { Skeleton } from '@mui/joy';
import TickerDisplay from '../TickerDisplay';

export const TransactionProfitLossColumn: React.FC<{
  total: number;
  size: number;
  side: string;
}> = ({ total, size, side }) => {
  const { priceFeed } = usePriceHistory();

  const currentPrice = priceFeed || 0;
  const currentValue = size * currentPrice;

  let profitLoss;
  if (side === 'BUY') {
    profitLoss = currentValue - Math.abs(total);
  } else {
    profitLoss = Math.abs(total) - currentValue;
  }

  const color = profitLoss > 0 ? '#27AD75' : '#F0616D';

  return (
    <Box style={{ color }}>
      <Skeleton variant="rectangular" overlay={true} loading={!priceFeed}>
        <span>
          <TickerDisplay value={profitLoss} format={'USD'} fracDigits={2} showArrow />
        </span>
      </Skeleton>
    </Box>
  );
};
