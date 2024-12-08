/** @jsxImportSource @emotion/react */
import React, {} from 'react';
import Box from '@mui/material/Box';
import { usePriceFeed } from '../context/CoinbaseWsFeedContext';
import TickerDisplay from './TickerDisplay';
import type { CoinSummaryResp } from '../../types/global';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';


interface Props {
  coinSummary: CoinSummaryResp;
  selectedPlType: 'roi' | 'ror'
}

export const ProfitLossCell: React.FC<Props> = ({
  coinSummary,
  selectedPlType
}) => {
  const {
    productName: unit,
    holdings,
    costBasis,
    profitLossAtCurrentPrice: backupProfitLossAtCurrentPrice,
    netContributions, 
  } = coinSummary;

  const { price } = usePriceFeed(`${unit}-USD`);

  let curPl: number;
  if (!price) {
    curPl = backupProfitLossAtCurrentPrice;
  } else {
    curPl = price * holdings - costBasis;
  }

  let percentPL: number;
  if (selectedPlType === 'ror') {
    // Rate of Return
    percentPL = ((curPl / costBasis) * 100);
  } else {
    // Return on Investment
    percentPL = ((curPl / netContributions) * 100);
  }

  const color = curPl > 0 ? '#27AD75' : '#F0616D';

  return (
    <Box className="text-left" style={{ color, fontFamily: 'Roboto Mono, monospace' }}>
      <span>
        <TickerDisplay cur={curPl} format={'USD'} fracDigits={2} />
      </span>
      <br></br>
      <span style={{ visibility: 'hidden' }}> ▲ </span>
      <span className="text-xl text-xs md:text-base lg:text-base xl:text-sm">
        <TickerDisplay cur={percentPL} format={'PERCENTAGE'} showArrow={false} />
      </span>
    </Box>
  );
};


export const ProfitLossFilter: React.FC<{
  selectedPlType: 'roi' | 'ror';
  setSelectedPlType: (newValue: 'roi' | 'ror') => void;
}> = ({ selectedPlType, setSelectedPlType }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'left',
      }}
    >
      <Select
        className="uppercase dark:text-gray-400"
        onChange={(event: React.SyntheticEvent | null, newValue: 'roi' | 'ror' | null) => {
          event?.preventDefault();
          if (newValue) {
            setSelectedPlType(newValue);
          }
        }}
        defaultValue={selectedPlType}
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
        <Option value="roi">Return on Investment</Option>
        <Option value="ror">Rate of Return</Option>
      </Select>
    </div>
  );
};
