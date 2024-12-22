/** @jsxImportSource @emotion/react */
import React, {} from 'react';
import Box from '@mui/material/Box';
import { usePriceFeed } from '../../context/CoinbaseWsFeedContext';
import TickerDisplay from '../TickerDisplay';
import type { CoinSummaryResp } from '../../../types/global';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import { useStatsTableContext } from '../../context/StatsTableContext';
import { Skeleton } from '@mui/joy';


interface Props {
  coinSummary: CoinSummaryResp;
}

export const ProfitLossCell: React.FC<Props> = ({ coinSummary }) => {
  const {
    productName: unit,
    holdings,
    costBasis,
    profitLossAtCurrentPrice: backupProfitLossAtCurrentPrice,
    netContributions,
  } = coinSummary;

  const { selectedPlType } = useStatsTableContext();

  const { price, loading } = usePriceFeed(`${unit}-USD`);

  let curPl: number;
  if (!price) {
    curPl = backupProfitLossAtCurrentPrice;
  } else {
    curPl = price * holdings - costBasis;
  }

  let percentPL: number;
  if (selectedPlType === 'ror') {
    // Rate of Return
    percentPL = (curPl / costBasis) * 100;
  } else {
    // Return on Investment
    percentPL = (curPl / netContributions) * 100;
  }

  const color = curPl > 0 ? '#27AD75' : '#F0616D';

  return (
    <Box style={{ color }}>
      <Skeleton variant="rectangular" overlay={true} loading={loading}>
        <span>
          <TickerDisplay value={curPl} format={'USD'} fracDigits={2} showArrow />
        </span>
        <br></br>
        <span style={{ visibility: 'hidden' }}>{'▲▲'}</span>
        <span className="text-right">
          <TickerDisplay value={percentPL} format={'PERCENTAGE'} />
        </span>
      </Skeleton>
    </Box>
  );
};


export const ProfitLossFilter: React.FC<{
  // selectedPlType: 'roi' | 'ror';
  // setSelectedPlType: (newValue: 'roi' | 'ror') => void;
}> = () => {
  const { selectedPlType, setSelectedPlType } = useStatsTableContext();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'left',
        padding: '0px',
        width: '0px',
      }}
    >
      <Select
        className="uppercase dark:text-gray-400 p-0 w-[0px]"
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

export const ProfitLossHeader: React.FC = () => {
  const { selectedPlType } = useStatsTableContext();
  return (
    <>
      Total/{selectedPlType}
    </>
  );
};
