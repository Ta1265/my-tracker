import React from 'react';
import Skeleton from '@mui/joy/Skeleton';
import type { CoinSummaryResp } from '../../../types/global';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import { usePriceFeed } from '../../context/CoinbaseWsFeedContext';
import TickerDisplay from '../TickerDisplay';
import Box from '@mui/material/Box';
import { useStatsTableContext } from '../../context/StatsTableContext';

const DeltaCell:React.FC<{
  coinSummary: CoinSummaryResp;
}> = ({
  coinSummary,
}) => {
  const { productName: unit, currentPrice: backupCurrenPrice, holdings } = coinSummary;

  const {
    selectedPlType,
    timeFrameCoinsPl,
    timeFrameCoinsPlIsLoading: isPending,
  } = useStatsTableContext();

  const { pastPl } = timeFrameCoinsPl?.[unit] || { pastPl: 0, curPl: 0,}

  const { price: priceFeed } = usePriceFeed(`${unit}-USD`);

  const curPrice = priceFeed || backupCurrenPrice;
  const curPl = curPrice * holdings - coinSummary.costBasis;
  const pastToCurrentPl = curPl - pastPl

  const ror = ((pastToCurrentPl / coinSummary.costBasis) * 100);
  const roi = ((pastToCurrentPl / coinSummary.netContributions) * 100) 

  const percentPl = selectedPlType === 'roi' ? roi : ror;

  const isLoading = isPending;



  const color = pastToCurrentPl < 0 ? '#F0616D' : '#27AD75';
  // const arrow = pastToCurrentPl > 0 ? '▲ ' : '▼ ';

  return (
    <Box className="" style={{ color }}>
      <Skeleton variant="rectangular" overlay={true} loading={isLoading}>
        <TickerDisplay value={pastToCurrentPl} format={'USD'} fracDigits={2} showArrow />
        <br></br>       

        <span style={{ visibility: 'hidden' }}>{'▲▲'}</span>
        <span className="text-right">
        <TickerDisplay value={percentPl} format={'PERCENTAGE'} fracDigits={2} />
        {/* <span className="text-xs capitalize"> {selectedPlType.toUpperCase()} </span> */}
        </span>
      </Skeleton>
    </Box>
  );
};


export const DeltaSelectFilter: React.FC<{}> = ({}) => {
  const { selectedTimeFrame, setSelectedTimeFrame } = useStatsTableContext();

  return (
    <span>
      <div
        style={{
          position: 'relative',
          display: 'inline',
          justifyContent: 'center !important',
          padding: '0px',
          width: '30px',
        }}
      >
        <Select
          className="uppercase dark:text-gray-400"
          onChange={(
            event: React.SyntheticEvent | null,
            newValue: 'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all' | null,
          ) => {
            event?.preventDefault();
            event?.stopPropagation();
            if (newValue) {
              setSelectedTimeFrame(newValue);
            }
          }}
          defaultValue={selectedTimeFrame}
          renderValue={() => ``}
          sx={{
            padding: '0px',
            border: 0,
            textAlign: 'center',
            fontSize: 'inherit',
            backgroundColor: 'inherit',
            '&:hover': {
              backgroundColor: 'inherit',
            },
          }}
        >
          <Option value="h">HOUR</Option>
          <Option value="d">DAY</Option>
          <Option value="w">WEEK</Option>
          <Option value="m">1 M</Option>
          <Option value="3m">3 M</Option>
          <Option value="6m">6 M</Option>
          <Option value="y">1 Y</Option>
          <Option value="all">ALL</Option>
        </Select>
      </div>
    </span>
  );
};

const DeltaHeader: React.FC = () => {
  const { selectedTimeFrame } = useStatsTableContext();
  return (
    <>DELTA - {selectedTimeFrame} </>
  );
}

export const DeltaHeaderMemo = React.memo(DeltaHeader)
export const DeltaCellMemo = React.memo(DeltaCell)
export const DeltaSelectFilterMemo = React.memo(DeltaSelectFilter)

