import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import React, { useEffect, useState } from 'react';
import 'chartjs-adapter-moment';
import SingleStat from './SingleStat';
import moment from 'moment';
import { useFetchCurrentPrice } from '../_hooks/useFetchCurrentPrice';
import { useFetchPriceHistory } from '../_hooks/useFetchPriceHistory';
import Box from '@mui/joy/Box';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import { usePriceFeed } from '../context/CoinbaseWsFeedContext';
import TickerDisplay from './TickerDisplay';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/joy/Skeleton';

const VerticalLiner = {
  id: 'verticalLiner',
  defaults: {
    width: 2,
    color: 'grey',
    dash: [5, 5],
  },
  afterInit: (chart: any, args: any, opts: any) => {
    chart.verticalLiner = {
      x: 0,
      y: 0,
    };
  },
  afterEvent: (chart: any, { inChartArea, event }: { inChartArea: any; event: any }) => {
    chart.verticalLiner = {
      x: event.x,
      y: chart?.tooltip?.caretY || event.y,
      draw: inChartArea,
    };
    chart.draw();
  },
  beforeDatasetsDraw: (chart: any, args: any, opts: any) => {
    const { ctx } = chart;
    const { top, bottom, left, right } = chart.chartArea;
    const x = chart.verticalLiner?.x;
    const y = chart.verticalLiner?.y;
    const draw = chart.verticalLiner?.draw;
    if (!draw) return;

    ctx.save();

    ctx.beginPath();
    ctx.lineWidth = opts.width;
    ctx.strokeStyle = opts.color;

    ctx.setLineDash(opts.dash);
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, top);
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    ctx.restore();
  },
} as const;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  VerticalLiner,
);

type TimeFrameSettings = {
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

const timeFrameSettingsMap: {
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

const PriceChart: React.FC<{ unit: string; productFullName: string }> = ({
  unit,
  productFullName,
}) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('d');
  const [hoveringChart, setHoveringChart] = useState<boolean>(false);
  const [hoverPrice, setHoverPrice] = useState<string | null>(null);
  const [tfSettings, setTfSettings] = useState<TimeFrameSettings>(
    timeFrameSettingsMap[timeFrame],
  );
  const { price: priceFeed } = usePriceFeed(`${unit}-USD`);
  const { currentPrice } = useFetchCurrentPrice(unit, timeFrame);
  const showPrice = priceFeed || parseFloat(currentPrice || '0');


  const {
    priceData,
    priceChange,
    isLoading: priceHistoryLoading,
  } = useFetchPriceHistory(productFullName, timeFrame);

  const startPrice = priceData[0][1];

  const thePrice = hoveringChart ? parseFloat(hoverPrice?.replace(/[$,]/g, '') || '0') : showPrice;

  const priceDiff = thePrice - startPrice;
  const pc = priceDiff / showPrice;




  useEffect(() => {
    if (priceHistoryLoading) return;
    const newSettings =
      timeFrameSettingsMap[timeFrame].titleText !== tfSettings.titleText;

    if (newSettings) setTfSettings(timeFrameSettingsMap[timeFrame]);
  }, [priceHistoryLoading, tfSettings, timeFrame]);

  return (
    <>
      <div className="flex py-2">
        <Grid container spacing={0} direction="column" className="text-md sm:text-xl">
          <Grid item className="capitalize">
            <span>
              {productFullName} ({unit}){' '}
            </span>
          </Grid>
          <Grid item>
            <Grid container spacing={1} direction="row">
              <Grid item>
                <Skeleton loading={priceHistoryLoading} variant="rectangular">
                  <span
                    style={{
                      ...(pc > 0 ? { color: '#27AD75' } : { color: '#F0616D' }),
                    }}
                  >
                    {pc > 0 ? '▲' : '▼'}
                  </span>
                  <TickerDisplay
                    cur={thePrice}
                    format={'USD'}
                    shouldAnimate={!hoveringChart}
                    constantArrow={false}
                    showArrow={false}
                  />
                </Skeleton>
              </Grid>
              <Grid
                item
                style={{
                  ...(pc > 0 ? { color: '#27AD75' } : { color: '#F0616D' }),
                }}
              >
                <Skeleton loading={priceHistoryLoading} variant="rectangular">
                  {'('}
                  <TickerDisplay
                    cur={pc * 100}
                    format={'PERCENTAGE'}
                    shouldAnimate={!hoveringChart}
                    constantArrow={false}
                    showArrow={false}
                  />
                  {')'}
                </Skeleton>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
        <div className="flex-grow text-center">
          <Select
            // className="ml-auto rounded-md bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
            className="
            hover:border-grey-700
            font-b
            ml-auto
            bg-gray-700
            px-1
            py-2
            text-white
            dark:bg-black
            text-xl sm:text-xl

          "
            onChange={(
              event: React.SyntheticEvent | null,
              newValue: 'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all',
            ) => {
              setTimeFrame(newValue);
            }}
            defaultValue={timeFrame}
            sx={{
              border: 0,
              fontSize: {
                sm: '20px',
                md: '20px',
                lg: '24px',
              }
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
        </div>
      </div>
      {/* <Box width={900} height={337}> */}
      <Box
        className="mx-auto flex w-full items-center justify-center"
        style={{
          touchAction: 'none',
          maxHeight: '450px',
        }}
      >
        {/* <Skeleton
          loading={priceHistoryLoading}
          style={{
            display: 'block',
            boxSizing: 'border-box',
            maxHeight: innerWidth < 768 ? '178px' :'450px',
            maxWidth: '900px',
          }}
        /> */}
        <Line
          onMouseLeave={() => setHoveringChart(false)}
          onMouseEnter={() => setHoveringChart(true)}
          options={{
            responsive: true,
            animation: {
              duration: 50,
              easing: 'easeInOutQuad',
            },
            plugins: {
              VerticalLiner: {},
              legend: {
                display: false,
              },
              title: {
                display: true,
                text: tfSettings.titleText,
                font: {
                  size: 12,
                },
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0,0,0,0.0)',
                titleFont: {
                  weight: 'bold',
                  size: 20,
                },
                caretPadding: 50,
                callbacks: {
                  title: (context) => moment(context[0].label).format('MMM D, YYYY h:mm a'),
                  label: (context) => {
                    setHoverPrice(
                      hoveringChart
                        ? context.parsed.y.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            maximumFractionDigits: 2,
                          })
                        : null,
                    );

                    return '';
                  },
                },
              },
            },
            scales: {
              x: {
                type: 'time',
                time: {
                  unit: tfSettings.unit,
                  parser: 'X', // Parsing the input as Unix timestamp (seconds)
                  displayFormats: {
                    minute: 'h:mm a',
                    hour: 'h:mm a',
                    day: 'MMM-DD-YY',
                  },
                },
                ticks: {
                  source: 'auto',
                  autoSkip: true,
                  maxTicksLimit: 6,
                  font: {
                    size: window.innerWidth < 768 ? 10 : 14,
                  },
                  display: true,
                },
              },
              y: {
                ticks: {
                  source: 'auto',
                  autoSkip: true,
                  maxTicksLimit: 6,
                  font: {
                    size: window.innerWidth < 768 ? 10 : 14,
                  },
                  callback: (value, index, values) => {
                    if (+value >= 1000) {
                      return (+value / 1000).toFixed(1) + 'k';
                    } else {
                      return value.toFixed(1);
                    }
                  },
                  display: window.innerWidth < 768 ? false : true,
                },
              },
            },
          }}
          data={{
            labels: priceData
              .filter((_, i) => i % tfSettings.downSample === 0)
              .map(([date, _]) => date * 1000),
            datasets: [
              {
                label: unit,
                data: priceData
                  .filter((_, i) => i % tfSettings.downSample === 0)
                  .map(([_, price]) => price),
                borderColor: priceChange > 0 ? '#27AD75' : '#F0616D',
                pointRadius: 0,
                tension: 0,
                borderWidth: 2,
                // pointHoverRadius: 10,
                // pointStyle: 'circle',
                // pointBackgroundColor: 'grey',
                // pointBorderColor: 'grey-800',
                // pointHoverBorderColor: 'grey-800',
                // fill: true,
              },
            ],
          }}
        />
      </Box>
      <br />

      <SingleStat
        unit={unit}
        priceChange={priceChange}
        timeFrame={timeFrame}
        timeFrameStartPrice={priceData[0] ? (priceData[0][1] ? priceData[0][1] : 0) : 0}
        loading={priceHistoryLoading}
      />
    </>
  );
};

export default PriceChart;
