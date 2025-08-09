import React from 'react';
import type { PortfolioSummary } from '../../../types/global';
import { InfoTable } from './InfoTable';

interface BreakDownProps {
  data: PortfolioSummary;
  showBreakdown: boolean;
  setShowBreakdown: (show: boolean) => void;
}

export const BreakDown: React.FC<BreakDownProps> = ({
  data,
  showBreakdown,
  setShowBreakdown,
}) => {
  return (
      <div
        className="flex flex-wrap justify-center"
        onClick={() => setShowBreakdown(!showBreakdown)}
      >
        <InfoTable
          rows={[
            { label: 'Net Cash:', sign: '', value: data?.netCashHoldings },
            {
              label: 'Net Contrib.:',
              sign: '-',
              value: data?.netContributions,
            },
            {
              end: true,
              label: 'Realized:',
              sign: '',
              value: data?.realizedReturn,
            },
          ]}
        />
        <InfoTable
          rows={[
            { label: 'Purchases:', sign: '', value: data?.purchases },
            { label: 'Sales:', sign: '-', value: data?.sales },
            {
              end: true,
              label: 'Cost Basis:',
              sign: '',
              value: data?.costBasis,
            },
          ]}
        />
        <InfoTable
          rows={[
            { label: 'Holdings Value:', sign: '', value: data?.valueOfHoldings },
            { label: 'Cost Basis:', sign: '-', value: data?.costBasis },
            {
              end: true,
              label: 'Total P/L:',
              sign: '',
              value: data?.totalPLatCurrentPrice,
            },
          ]}
        />
        <InfoTable
          rows={[
            {
              label: 'Total P/L:',
              sign: '',
              value: data?.totalPLatCurrentPrice,
            },
            { label: 'Net Contrib.:', sign: '÷', value: data?.netContributions },
            { end: true, label: 'ROI:', sign: '', value: data?.roi, type: 'PERCENTAGE' },
          ]}
        />
      </div>
  )
}