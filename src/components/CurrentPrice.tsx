/** @jsxImportSource @emotion/react */
import React from 'react';
import Box from '@mui/material/Box';
import { usePriceFeed } from '../context/CoinbaseWsFeedContext';
import TickerDisplay from './TickerDisplay';

  

const CurrentPrice: React.FC<{
  unit: string;
  backupCurrentPrice: string;
}> = ({ unit, backupCurrentPrice }) => {
  const { price } = usePriceFeed(`${unit}-USD`);

  const currentPrice = price || parseFloat(backupCurrentPrice.replace(/[$,]/g, ''));

  return (
    <>
      <Box className="text-left">
        <TickerDisplay cur={currentPrice} format={'USD'} />
      </Box>
    </>
  );
};

export default CurrentPrice;