import React from 'react';
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
import { timeFrameSettingsMap } from '../../product/TimeFrameSelect';

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

export const LineChart: React.FC<Props> = ({
  inGreen,
  hoverIndex,
  setHoverIndex,
  netRows,
  lowestPointIndex,
  highestPointIndex,
}) => {
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
            // @ts-ignore
            VerticalLiner: {},
            legend: {
              display: false,
            },
            title: {
              display: true,
              text: titleText, 
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
                font: {},
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
          ],
        }}
      />
    </>
  );
};
