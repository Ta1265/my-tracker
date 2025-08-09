import React from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/joy/Tooltip';
import type { CoinSummaryResp } from '../../../types/global';
import { formatValue } from '../../utils/formatDollars';

export const CostBasisCell: React.FC<{
  coinSummary: CoinSummaryResp;
}> = ({ coinSummary }) => {
  const { valueOfHoldings: backupValueOfHoldings } = coinSummary;

  return (
    <Box className="ticker-font text-left">
      <Tooltip title="Cost Basis">
        <>
          <span style={{ visibility: 'hidden' }}> ▲ </span>
          <span title="Cost Basis">{formatValue(coinSummary.costBasis, 'USD')}</span>
        </>
      </Tooltip>
      <br></br>
      <Tooltip title="Break Even ">
        <>
          <span style={{ visibility: 'hidden' }}> ▲ </span>
          <span title="Break Even" className="">
            {coinSummary.costBasis < 1 || backupValueOfHoldings < 1 ? (
              'N/A'
            ) : (
              <>{formatValue(coinSummary.breakEvenPrice, 'USD')}</>
            )}
          </span>
        </>
      </Tooltip>
    </Box>
  );
};
