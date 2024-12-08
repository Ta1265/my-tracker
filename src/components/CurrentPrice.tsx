import React from 'react';
import Box from '@mui/material/Box';
import { usePriceFeed } from '../context/CoinbaseWsFeedContext';
import TickerDisplay from './TickerDisplay';

  

const CurrentPrice: React.FC<{
  unit: string;
  backupCurrentPrice: number;
}> = ({ unit, backupCurrentPrice }) => {
  const { price } = usePriceFeed(`${unit}-USD`);

  const currentPrice = price || backupCurrentPrice;

  return (
    <>
      <Box className="text-left">
        <TickerDisplay cur={currentPrice} format={'USD'} />
      </Box>
    </>
  );
};

export default CurrentPrice;