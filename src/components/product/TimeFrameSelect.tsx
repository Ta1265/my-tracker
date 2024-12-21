import React from 'react';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import { usePriceHistory } from '../../context/PriceHistoryProvider';

export type TimeFrame = 'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all';

export type TimeFrameSettings = {
  titleText: string;
  unit:
    | false
    | 'minute'
    | 'hour'
    | 'day'
    | 'millisecond'
    | 'second'
    | 'week'
    | 'month'
    | 'quarter'
    | 'year'
    | undefined;
  displayFormat: string;
  downSample: number;
};

export const timeFrameSettingsMap: {
  [key: string]: TimeFrameSettings;
} = {
  h: {
    titleText: 'Last Hour',
    unit: 'minute',
    displayFormat: 'HH:MM a',
    downSample: 1,
  },
  d: {
    titleText: '24 Hours',
    unit: 'hour',
    displayFormat: 'HH:MM',
    downSample: 1,
  },
  w: {
    titleText: '7 Days',
    unit: 'day',
    displayFormat: 'h:mm a',
    downSample: 6,
  },
  m: {
    titleText: '30 Days',
    unit: 'day',
    displayFormat: 'MMM D',
    downSample: 8,
  },
  '3m': {
    titleText: '3 Months',
    unit: 'day',
    displayFormat: 'MMM D',
    downSample: 8,
  },
  '6m': {
    titleText: '6 Months',
    unit: 'day',
    displayFormat: 'MMM D',
    downSample: 1,
  },
  y: {
    titleText: '1 Year',
    unit: 'day',
    displayFormat: 'MMM D',
    downSample: 1,
  },
  all: {
    titleText: 'All Time',
    unit: 'day',
    displayFormat: 'MMM D',
    downSample: 5,
  },
};

interface Props {
}

export const TimeFrameSelect: React.FC<Props> = () => {
  const {
    setTimeFrame,
    timeFrame,
  } = usePriceHistory();
  return (
    <Select
      // className="ml-auto rounded-md bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
      className="
            hover:border-grey-700
            font-b
            ml-auto
            bg-gray-700
            px-1
            py-2
            text-xl
            text-white
            dark:bg-black sm:text-xl

          "
      onChange={(
        event: React.SyntheticEvent | null,
        newValue: 'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all' | null,
      ) => {
        if (!newValue) return;
        setTimeFrame(newValue);
      }}
      defaultValue={timeFrame}
      sx={{
        border: 0,
        fontSize: {
          sm: '20px',
          md: '20px',
          lg: '24px',
        },
      }}
    >
      <Option value="h"> Hour</Option>
      <Option value="d"> Day</Option>
      <Option value="w"> Week</Option>
      <Option value="m"> Month</Option>
      <Option value="3m"> 3 Month</Option>
      <Option value="6m"> 6 Month</Option>
      <Option value="y"> 1 Year</Option>
      <Option value="all"> All Time</Option>
    </Select>
  );
};
