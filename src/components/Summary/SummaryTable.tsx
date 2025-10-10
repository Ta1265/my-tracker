/* eslint-disable react/jsx-key */
import React from 'react';
import type { PortfolioSummary, TimeFrameTotalPlResp } from '../../../types/global';
import { useQuery } from '@tanstack/react-query';
import { useStatsTableContext } from '../../context/StatsTableContext';
import { BreakDown } from './BreakDown';
import { TotalChart } from './TotalChart';
import { Box } from '@mui/joy';
import { MoreHoriz, CheckBox, CheckBoxOutlineBlank } from '@mui/icons-material';
import { Dropdown } from 'flowbite-react';
import { TotalsSummary } from './TotalsSummary';

const SummaryTable: React.FC<{}> = () => {
  const { selectedTimeFrame } = useStatsTableContext();
  
  const [showChart, setShowChart] = React.useState(true);
  const [showSummary, setShowSummary] = React.useState(false);
  const [showBreakdown, setShowBreakdown] = React.useState(false);

  const { isPending, isError, data: portfolioSummary, error } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async ({ signal }): Promise<PortfolioSummary> => {
      const resp = await fetch('/api/summary/portfolio', { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
    refetchInterval: 5000,
  });

  const { data: timeFramePlResp, isLoading: timeFramePlLoading } = useQuery({
    queryKey: ['time-frame-total-pl', selectedTimeFrame],
    queryFn: async ({ signal }): Promise<TimeFrameTotalPlResp> => {
      const resp = await fetch(`/api/time-frame-total-pl/${selectedTimeFrame}`, { signal });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
    refetchInterval: 5000,
  });

  const currentTotalValue = timeFramePlResp?.currentTotalValue || 0;
  const pastTotalValue = timeFramePlResp?.pastTotalValue || 0;

  const timeFramePl = currentTotalValue - pastTotalValue;
  const timeFramePercentPl = (timeFramePl / (pastTotalValue || 1)) * 100;

  const inGreen = portfolioSummary?.inGreen || false;

  if (isError) {
    console.error(error);
    return <div>Error Loading Portfolio Summary.</div>;
  }

  return (
    <Box display="flex" flexDirection={'column'} width="100%">
      {showChart && (
        <TotalChart
          totalsLoading={isPending}
          currentTotalValue={portfolioSummary?.valueOfHoldings || 0}
          currentRoi={portfolioSummary?.roi || 0}
          currentProfitLoss={portfolioSummary?.totalPLatCurrentPrice || 0}
          timeFramePl={timeFramePl}
          timeFramePercentPl={timeFramePercentPl}
          selectedTimeFrame={selectedTimeFrame}
          timeFramePlLoading={timeFramePlLoading}
        />
      )}

      {showSummary && (
        <TotalsSummary
          inGreen={inGreen}
          timeFramePl={timeFramePl}
          timeFramePercentPl={timeFramePercentPl}
          timeFramePlLoading={timeFramePlLoading}
          isPending={isPending}
          selectedTimeFrame={selectedTimeFrame}
          roi={portfolioSummary?.roi || 0}
          valueOfHoldings={portfolioSummary?.valueOfHoldings || 0}
          totalPLatCurrentPrice={portfolioSummary?.totalPLatCurrentPrice || 0}
        />
      )}

      {showBreakdown && <BreakDown data={portfolioSummary} />}

      <div className="justify-left flex p-0">
        <Dropdown
          className="z-[9999]"
          arrowIcon={false}
          inline
          label={<MoreHoriz className="cursor-pointer text-gray-600 hover:text-gray-800" />}
        >
          <Dropdown.Item
            className="flex items-center px-4 py-2"
            onClick={() => setShowChart(!showChart)}
          >
            {showChart ? (
              <CheckBox className="mr-2 text-blue-600" />
            ) : (
              <CheckBoxOutlineBlank className="mr-2 text-gray-400" />
            )}
            Show Chart
          </Dropdown.Item>
          <Dropdown.Item
            className="flex items-center px-4 py-2"
            onClick={() => setShowSummary(!showSummary)}
          >
            {showSummary ? (
              <CheckBox className="mr-2 text-blue-600" />
            ) : (
              <CheckBoxOutlineBlank className="mr-2 text-gray-400" />
            )}
            Show Summary
          </Dropdown.Item>
          <Dropdown.Item
            className="flex items-center px-4 py-2"
            onClick={() => setShowBreakdown(!showBreakdown)}
          >
            {showBreakdown ? (
              <CheckBox className="mr-2 text-blue-600" />
            ) : (
              <CheckBoxOutlineBlank className="mr-2 text-gray-400" />
            )}
            Show Breakdown
          </Dropdown.Item>
        </Dropdown>
      </div>
    </Box>
  );
};

export default SummaryTable;
