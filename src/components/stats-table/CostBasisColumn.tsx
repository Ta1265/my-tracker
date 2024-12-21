import React from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/joy/Tooltip';
import type { CoinSummaryResp } from '../../../types/global';


export const CostBasisCell: React.FC<{
  coinSummary: CoinSummaryResp;
}> = ({ coinSummary }) => {

  return (
    <Box
      className="text-left ticker-font"
    >
      <Tooltip title="Cost Basis">
        <>
          <span style={{ visibility: 'hidden' }}> ▲ </span>
          <span title="Cost Basis">
            {coinSummary.costBasis.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </>
      </Tooltip>
      <br></br>
      <Tooltip title="Break Even ">
        <>
          <span style={{ visibility: 'hidden' }}> ▲ </span>
          <span title="Break Even" className="">
            {coinSummary.costBasis < 1
              ? 'N/A'
              : coinSummary.breakEvenPrice.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </span>
        </>
      </Tooltip>
    </Box>
  );
};