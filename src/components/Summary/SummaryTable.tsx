/* eslint-disable react/jsx-key */
import React from 'react';
import { useStatsTableContext } from '../../context/StatsTableContext';
import { BreakDown } from './BreakDown';
import { TotalChartLayout } from './TotalChart/Layout';
import { Box } from '@mui/joy';
import { MoreHoriz, CheckBox, CheckBoxOutlineBlank } from '@mui/icons-material';
import { Dropdown } from 'flowbite-react';
import { TotalsSummary } from './TotalsSummary';
import { SummaryContextProvider } from './SummaryContext';
import { useLocalStorage } from '../../_hooks/useLocalStorage';

const SummaryTable: React.FC<{}> = () => {
  const { selectedTimeFrame } = useStatsTableContext();

  const [showChart, setShowChart] = useLocalStorage('showChart', true);
  const [showSummary, setShowSummary] = useLocalStorage('showSummary', false);
  const [showBreakdown, setShowBreakdown] = useLocalStorage('showBreakdown', false);

  return (
    <SummaryContextProvider selectedTimeFrame={selectedTimeFrame}>
      <Box display="flex" flexDirection={'column'} width="100%" gap="20px">
        {showChart && <TotalChartLayout />}

        {showBreakdown && <BreakDown />}

        {showSummary && <TotalsSummary />}

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
    </SummaryContextProvider>
  );
};

export default SummaryTable;
