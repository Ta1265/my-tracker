import React from 'react';
import Box from '@mui/material/Box';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from './LineChart';
import { HoveredPrice } from './HoveredPrice';
import { TimeFrameDelta } from './TimeFrameDelta';
import { useStatsTableContext } from '../../../context/StatsTableContext';
import { useSummaryContext } from '../SummaryContext';
import { type ProfitLossChartResp } from '../../../../types/global';

const emptyData: ProfitLossChartResp = {
  netRows: [],
  lowestPointIndex: 0,
  highestPointIndex: 0,
};

export const TotalChartLayout: React.FC<{}> = ({}) => {
  const { selectedTimeFrame } = useStatsTableContext();

  const { portfolioSummaryIsPending, portfolioSummary } = useSummaryContext();

  const [dataIndex, setDataIndex] = React.useState<number | null>(null);

  const { data = emptyData, isLoading: chartValuesLoading } = useQuery({
    queryKey: ['profit-loss-chart', selectedTimeFrame],
    queryFn: async ({ signal }): Promise<ProfitLossChartResp> => {
      const resp = await fetch(`/api/summary/profitLossChart?timeFrame=${selectedTimeFrame}`, {
        signal,
      });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
  });

  const { netRows, lowestPointIndex, highestPointIndex } = data;

  const { valueOfHoldings, profitLoss, roi } = React.useMemo(() => {
    if (dataIndex !== null && netRows && netRows[dataIndex]) {
      return {
        valueOfHoldings: netRows[dataIndex].valueOfHoldings,
        profitLoss: netRows[dataIndex].profitLoss,
        roi: netRows[dataIndex].roi,
        inGreen: netRows[dataIndex].profitLoss >= 0,
      };
    }
    return {
      valueOfHoldings: portfolioSummary?.valueOfHoldings || 0,
      profitLoss: portfolioSummary?.totalPLatCurrentPrice || 0,
      roi: portfolioSummary?.roi || 0,
      inGreen: (portfolioSummary?.totalPLatCurrentPrice || 0) >= 0,
    };
  }, [netRows, dataIndex, portfolioSummary]);

  return (
    <>
      <div className="mx-auto mt-2 w-full" style={{ maxWidth: '900px' }}>
        <Box display="flex" justifyContent="space-between" flexDirection="row" width="100%">
          <HoveredPrice
            profitLoss={profitLoss}
            portfolioSummaryIsPending={portfolioSummaryIsPending || chartValuesLoading}
            valueOfHoldings={valueOfHoldings}
            roi={roi}
            dataIndex={dataIndex}
            lowestPointIndex={lowestPointIndex}
            highestPointIndex={highestPointIndex}
          />
          <TimeFrameDelta />
        </Box>
        <Box
          className="mx-auto flex w-full items-center justify-center"
          style={{ touchAction: 'none', maxHeight: '450px' }}
        >
          <LineChart
            netRows={netRows || []}
            inGreen={profitLoss >= 0}
            hoverIndex={dataIndex}
            setHoverIndex={setDataIndex}
            lowestPointIndex={lowestPointIndex}
            highestPointIndex={highestPointIndex}
          />
        </Box>
        <br />
      </div>
    </>
  );
};
