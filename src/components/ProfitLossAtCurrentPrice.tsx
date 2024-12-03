/** @jsxImportSource @emotion/react */
import React, {} from 'react';
import Box from '@mui/material/Box';
import { usePriceFeed } from '../context/CoinbaseWsFeedContext';
import TickerDisplay from './TickerDisplay';


interface Props {
  unit: string;
  holdings: number;
  costBasis: number;
  backupProfitLossAtCurrentPrice: string;
  backupPercentPl: string;
  netContributions: number
}

const ProfitLossAtCurrentPrice: React.FC<Props> = ({
  unit,
  holdings,
  costBasis,
  backupProfitLossAtCurrentPrice,
  netContributions,
}) => {
  const { price } = usePriceFeed(`${unit}-USD`);

  let curPl: number;
  if (!price) {
    curPl = parseFloat(backupProfitLossAtCurrentPrice.replace(/[$,]/g, ''));
  } else {
    curPl = price * holdings - costBasis;
  }

  const percentPL = ((curPl / netContributions) * 100)
  const color = curPl > 0 ? '#27AD75' : '#F0616D';

  return (
    <Box className="text-left" style={{ color, fontFamily: 'Roboto Mono, monospace' }}>
      <span>
        <TickerDisplay cur={curPl} format={'USD'} />
      </span>
      <br></br>
      <span style={{ visibility: 'hidden' }}> ▲ </span>
      <span className="text-xl text-xs md:text-base lg:text-base xl:text-sm">
        <TickerDisplay cur={percentPL} format={'PERCENTAGE'} showArrow={false} />
      </span>

    </Box>
  );
};

export default ProfitLossAtCurrentPrice;