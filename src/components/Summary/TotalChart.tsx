import React from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/joy/Skeleton';
import TickerDisplay from '../TickerDisplay';
import 'chartjs-adapter-moment';
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
import moment from 'moment';
import {
  timeFrameSettingsMap,
  type TimeFrame,
} from '../product/TimeFrameSelect';
import { useQuery } from '@tanstack/react-query';
import { DeltaSelectFilterMemo } from '../stats-table/DeltaColumn';
import { timeFrameDisplay } from '../SingleStat';

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
    const { top, bottom } = chart.chartArea;
    const x = chart.verticalLiner?.x;
    const draw = chart.verticalLiner?.draw;
    if (!draw) return;

    ctx.save();

    ctx.beginPath();
    ctx.lineWidth = opts.width;
    ctx.strokeStyle = opts.color;

    ctx.setLineDash(opts.dash);
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, top);
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

interface Props {
  inGreen: boolean;
  setHoverIndex: React.Dispatch<React.SetStateAction<null | number>>;
  hoverIndex: number | null;
  lowestPointIndex: number;
  highestPointIndex: number;
  netRows: Array<{
    date: number;
    valueOfHoldings: number;
    profitLoss: number;
    roi: number;
  }>;
}

const LineChart: React.FC<Props> = ({ inGreen, hoverIndex, setHoverIndex, netRows, lowestPointIndex, highestPointIndex }) => {
  let tfSettings = timeFrameSettingsMap['all'];

  const downSample = 7;  
  const { prices, dates } = React.useMemo(() => {
    const prices: number[] = [];
    const dates: number[] = [];

    netRows.forEach((row, idx) => {


      if (idx === lowestPointIndex || idx === highestPointIndex || idx % downSample === 0) {
        prices.push(row.valueOfHoldings);
        dates.push(row.date);
      }
    });
    return { prices, dates };
  }, [netRows, lowestPointIndex, highestPointIndex, downSample]);

  const titleText = React.useMemo(() => {
    if (hoverIndex && netRows?.[hoverIndex]?.date) {
      return moment(netRows[hoverIndex].date).format('MMM D, YYYY h:mm a');
    }
    return moment().format('MMM D, YYYY h:mm a');


    // if (hoverIndex === lowestPointIndex) return ' Lowest All Time';
    // if (hoverIndex === highestPointIndex) return ' Highest All Time';
    // if (hoverIndex !== null) return '';
    // if (selectedTimeFrame === 'h') return 'Last Hour';
    // if (selectedTimeFrame === 'd') return 'Last Day';
    // if (selectedTimeFrame === 'w') return 'Last Week';
    // if (selectedTimeFrame === 'm') return 'Last Month';
    // if (selectedTimeFrame === '3m') return 'Last 3 Months';
    // if (selectedTimeFrame === '6m') return 'Last 6 Months';
    // if (selectedTimeFrame === 'y') return 'Last Year';
    // if (selectedTimeFrame === 'all') return 'All Time';
    // return 'All Time';
  }, [hoverIndex, , netRows]);

  return (
    <>
      <Line
        style={{ touchAction: 'none' }}
        onMouseLeave={() => setHoverIndex(null)}
        // onMouseEnter={() => setHoveringChart(true)}
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
              text: titleText,//tfSettings.titleText,
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
                title: (context) => '',
                label: (context) => {
                  const originalIndex = context.dataIndex * 7;
                  if (Math.abs(originalIndex - lowestPointIndex) < 10) {
                    setHoverIndex(lowestPointIndex);
                  } else if (Math.abs(originalIndex - highestPointIndex) < 10) {
                    setHoverIndex(highestPointIndex);
                  } else {
                    setHoverIndex(originalIndex);
                  }
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
                parser: 'X',
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
                display: false,
              },
            },
            y: {
              ticks: {
                source: 'auto',
                autoSkip: true,
                maxTicksLimit: 6,
                font: {
                },
                callback: (value) => {
                  const val = +value;
                  if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
                  return val.toFixed(1);
                },
              },
            },
          },
        }}
        data={{
          labels: dates,
          datasets: [
            {
              label: 'Total',
              data: prices,
              borderColor: inGreen ? '#27AD75' : '#F0616D',
              pointRadius: 0,
              tension: 0,
              borderWidth: 2, // pointHoverRadius: 10,
              pointStyle: 'circle',
              pointBackgroundColor: 'grey',
              pointBorderColor: 'grey-800',
              pointHoverBorderColor: 'grey-800',
              fill: true,
            },
            // Permanent line at $32,000
            // {
            //   label: '$32,000 Line',
            //   data: ,
            //   borderColor: '#888888',
            //   backgroundColor: 'transparent',
            //   borderWidth: 1,
            //   borderDash: [5, 5],
            //   pointRadius: 0,
            //   pointHoverRadius: 0,
            //   tension: 0,
            //   fill: false,
            // },
          ],
        }}
      />
    </>
  );
};

interface TotalChartProps {
  totalsLoading: boolean;
  currentTotalValue: number;
  currentRoi: number;
  currentProfitLoss: number;
  timeFramePl: number | null;
  timeFramePercentPl: number | null;
  selectedTimeFrame: TimeFrame;
  timeFramePlLoading: boolean;
}

export const TotalChart: React.FC<TotalChartProps> = ({
  totalsLoading,
  currentTotalValue,
  currentProfitLoss,
  currentRoi,
  timeFramePl,
  timeFramePercentPl,
  selectedTimeFrame,
  timeFramePlLoading,
}) => {
  
  const [dataIndex, setDataIndex] = React.useState<number | null>(null);

  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: ['profit-loss-chart'],
    queryFn: async ({
      signal,
    }): Promise<{
      highestPointIndex: number;
      lowestPointIndex: number;
      netRows: [
        {
          date: number;
          valueOfHoldings: number;
          profitLoss: number;
          roi: number;
        },
      ];
    }> => {
      const resp = await fetch(`/api/summary/profitLossChart?timeFrame=all`, {
        signal,
      });
      if (!resp.ok) {
        throw new Error('Network response error');
      }
      return resp.json();
    },
  });
  const { netRows, lowestPointIndex, highestPointIndex } = data || { netRows: [], lowestPointIndex: 0, highestPointIndex: 0 };

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
      valueOfHoldings: currentTotalValue || 0,
      profitLoss: currentProfitLoss || 0,
      roi: currentRoi || 0,
      inGreen: (currentProfitLoss || 0)  >= 0,
    };
  }, [netRows, dataIndex, currentTotalValue, currentProfitLoss, currentRoi]);

  const color = profitLoss >= 0 ? '#27AD75' : '#F0616D';

  return (
    <>
      <div className="mx-auto mt-2 w-full" style={{ maxWidth: '900px' }}>
        <Box
          display="flex"
          justifyContent="space-between"
          flexDirection="row"
          width="100%"
        >
          <Box
            display="flex"
            flexDirection="column"
            width="50%"
            alignItems="right"
            textAlign="right"
          >
            <Skeleton loading={totalsLoading} variant="rectangular" width="50%" height="100%">
              <div
                className="min-w-[50px] text-left md:text-2xl font-bold"
                style={{
                  color,
                }}
              >
                <TickerDisplay
                  value={valueOfHoldings}
                  format={'USD'}
                  fracDigits={2}
                  type={'animate'}
                />
              </div>
            </Skeleton>
            <Skeleton loading={totalsLoading} variant="rectangular" width="50%" height="100%">
              <div
                className="min-w-[50px] text-left text-xs"
                style={{
                  color,
                }}
              >
                <span className="flex flex-col md:flex-row">
                  <span>
                    <TickerDisplay
                      value={profitLoss || 0}
                      format={'USD'}
                      fracDigits={2}
                      showArrow
                    />
                    
                    &nbsp;
                    {`(`}
                    <TickerDisplay
                      value={roi || 0}
                      format={'PERCENTAGE'}
                      fracDigits={2}
                    />
                    {')'}
                  </span>
                  <span className="text-left text-gray-700 dark:text-gray-400">
                    &nbsp;
                    {(() => {
                      if (dataIndex === lowestPointIndex) return ' Lowest All Time';
                      if (dataIndex === highestPointIndex) return ' Highest All Time';
                      if (dataIndex !== null) return '';
                      // if (selectedTimeFrame === 'h') return 'Last Hour';
                      // if (selectedTimeFrame === 'd') return 'Last Day';
                      // if (selectedTimeFrame === 'w') return 'Last Week';
                      // if (selectedTimeFrame === 'm') return 'Last Month';
                      // if (selectedTimeFrame === '3m') return 'Last 3 Months';
                      // if (selectedTimeFrame === '6m') return 'Last 6 Months';
                      // if (selectedTimeFrame === 'y') return 'Last Year';
                      // if (selectedTimeFrame === 'all') return 'All Time';
                      return 'All Time';
                    })()}
                  </span>
                </span>
              </div>
            </Skeleton>
          </Box>

          <Box
            display="flex"
            flexDirection="column"
            width="50%"
            alignItems="flex-end"
            textAlign="right"
            className="justify-end"
          >
            <div className="flex max-h-[24px] min-w-[100px] flex-row items-center justify-end font-bold capitalize md:max-h-[31.99px] text-xs md:text-base text-right">
              <span className="text-right">P/L - {timeFrameDisplay[selectedTimeFrame]}</span>
              <DeltaSelectFilterMemo />
            </div>
              <div
                className="flex flex-row text-right justify-end"
                style={{
                  color: (timeFramePl || 0) > 0 ? '#27AD75' : '#F0616D',
                }}
              >
                <span className=" text-xs md:text-sm">
                  <TickerDisplay
                    value={timeFramePl || 0}
                    format={'USD'}
                    fracDigits={2}
                    type={'animate'}
                    showArrow
                  />
                </span>
                <span className="text-right text-xs md:text-left text-xs md:text-sm">
                  &nbsp;
                  {'('}
                  <TickerDisplay
                    value={timeFramePercentPl || 0}
                    format={'PERCENTAGE'}
                    fracDigits={2}
                    type={'animate'}
                  />
                  {')'}
                </span>
              </div>
          </Box>
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
