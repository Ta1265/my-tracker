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
import React, { useEffect, useState, useRef } from 'react';
import 'chartjs-adapter-moment';
import SingleStat from './SingleStat';
import Link from 'next/link';
import moment from 'moment';
import { useFetchCurrentPrice } from '../_hooks/useFetchCurrentPrice';
import { useFetchPriceHistory } from '../_hooks/useFetchPriceHistory';

const VerticalLiner = {
  id: 'verticalLiner',
  defaults: {
    width: 2,
    color: 'grey',
    dash: [5, 5],
  },
  afterInit: (chart, args, opts) => {
    chart.verticalLiner = {
      x: 0,
      y: 0,
    };
  },
  afterEvent: (chart, { inChartArea, event }) => {
    chart.verticalLiner = {
      x: event.x,
      y: chart?.tooltip?.caretY || event.y,
      draw: inChartArea,
    };
    chart.draw();
  },
  beforeDatasetsDraw: (chart, args, opts) => {
    const { ctx } = chart;
    const { top, bottom, left, right } = chart.chartArea;
    const { x, y, draw } = chart.verticalLiner;
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

  const { currentPrice } = useFetchCurrentPrice(unit, timeFrame);

  const {
    priceData,
    priceChange,
    isLoading: priceHistoryLoading,
  } = useFetchPriceHistory(productFullName, timeFrame);

  useEffect(() => {
    if (priceHistoryLoading) return;
    const newSettings =
      timeFrameSettingsMap[timeFrame].titleText !== tfSettings.titleText;

    if (newSettings) setTfSettings(timeFrameSettingsMap[timeFrame]);
  }, [priceHistoryLoading, tfSettings, timeFrame]);

  return (
    <>
      <div className="flex py-2">
        <div className="">
          <span className="text-4xl capitalize md:text-3xl ">
            {productFullName} ({unit}){' '}
          </span>
          <span
            className="px-1 text-2xl"
            style={{
              ...(priceChange > 0
                ? { color: '#27AD75' }
                : { color: '#F0616D' }),
            }}
          >
            {priceChange > 0 ? '▲' : '▼'} {(priceChange * 100).toFixed(2)} %
          </span>
        </div>
        <div className="px-3 text-3xl">
          {hoveringChart ? hoverPrice : currentPrice}
        </div>
        <div className="flex-grow text-center text-3xl"></div>
        <select
          // className="ml-auto rounded-md bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
          className="
            lg:text-md
            hover:border-grey-700
            font-b
            ml-auto
            bg-gray-700
            px-1
            py-2
            text-3xl
            text-white
            dark:bg-black
            md:text-xl
          "
          onChange={({ target: { value } }: any) => setTimeFrame(value)}
          defaultValue={timeFrame}
        >
          <option value="h"> Hour</option>
          <option value="d"> Day</option>
          <option value="w"> Week</option>
          <option value="m"> Month</option>
          <option value="3m"> 3 Month</option>
          <option value="6m"> 6 Month</option>
          <option value="y"> 1 Year</option>
          <option value="all"> All Time</option>
        </select>
      </div>
      <Line
        onMouseLeave={() => setHoveringChart(false)}
        onMouseEnter={() => setHoveringChart(true)}
        height="300px"
        width="800px"
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
                size: 14,
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
                title: (context) =>
                  moment(context[0].label).format('MMM D, YYYY h:mm a'),
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
                  size: 14,
                },
              },
            },
            y: {
              ticks: {
                source: 'auto',
                autoSkip: true,
                maxTicksLimit: 6,
                font: {
                  size: 14,
                },
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

      <br />
      <SingleStat
        unit={unit}
        priceChange={priceChange}
        timeFrame={timeFrame}
        timeFrameStartPrice={
          priceData[0] ? (priceData[0][1] ? priceData[0][1] : 0) : 0
        }
      />
    </>
  );
};

export default PriceChart;
