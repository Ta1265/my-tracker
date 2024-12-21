import React from "react";
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
import { timeFrameSettingsMap, type TimeFrame, type TimeFrameSettings } from './TimeFrameSelect';
import { usePriceHistory } from "../../context/PriceHistoryProvider";



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

interface Props {
}

export const LineChart: React.FC<Props> = () => {
  const { unit, setHoveringChart, timeFrame, setHoverPrice, priceData, priceChange } = usePriceHistory();

  const tfSettings = timeFrameSettingsMap[timeFrame];

  return (
    <>
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
                  setHoverPrice(context.parsed.y);
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
                // Parsing the input as Unix timestamp (seconds)
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
                  size: window?.innerWidth < 768 ? 10 : 14,
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
                  size: window?.innerWidth < 768 ? 10 : 14,
                },
                callback: (value) => {
                  const val = +value;
                  if (val >= 1000) {
                    return (val / 1000).toFixed(1) + 'k';
                  } else {
                    return val.toFixed(1);
                  }
                },
                display: window?.innerWidth < 768 ? false : true,
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
              borderWidth: 2, // pointHoverRadius: 10,
              // pointStyle: 'circle',
              // pointBackgroundColor: 'grey',
              // pointBorderColor: 'grey-800',
              // pointHoverBorderColor: 'grey-800',
              // fill: true,
            },
          ],
        }}
      />
    </>
  );
};
  