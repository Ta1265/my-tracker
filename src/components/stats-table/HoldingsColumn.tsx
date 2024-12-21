import React from 'react';
import { usePriceFeed } from '../../context/CoinbaseWsFeedContext';
import TickerDisplay from '../TickerDisplay';
import Box from '@mui/material/Box';
import type { CoinSummaryResp } from '../../../types/global';

interface Props {
  coinSummary: CoinSummaryResp;
}

export const HoldingsCell: React.FC<Props> = ({ coinSummary }) => {
  const { productName: unit, holdings, valueOfHoldings: backupValueOfHoldings, currentPrice } = coinSummary;
  const { price: priceFeed } = usePriceFeed(`${unit}-USD`);

  const price = priceFeed || currentPrice;

  let valueOfHoldings: number;
  if (price) {
    valueOfHoldings = price * holdings;
  } else {
    valueOfHoldings = backupValueOfHoldings
  }
  
  let decimalPlaces = 0;
  if (price >= 100000) {
    decimalPlaces = 5;
  } else if (price >= 10000) {
    decimalPlaces = 4;
  } else if (price >= 1000) {
    decimalPlaces = 3;
  } else if (price >= 100) {
    decimalPlaces = 2;
  }


  // let holdingsDigits = 0;
  // if (holdings < 100000) {
  //   const integerDigits = Math.floor(holdings).toString().length;
  //   holdingsDigits = Math.max(6 - integerDigits, 0);
  // }

  const roundedHoldings = parseFloat(holdings.toFixed(decimalPlaces));


  return (
    <Box
      className="text-left ticker-font"
      style={{
        // fontFamily: 'Roboto Mono, monospace',
      }}
    >
      <TickerDisplay value={valueOfHoldings} format={'USD'} fracDigits={2} showArrow />
      <br></br>
      <span style={{ visibility: 'hidden' }}> ▲ </span>
      <span className="text-xs">{coinSummary.productName} </span>
      <span className="">{roundedHoldings}</span>
    </Box>
  );


};
