'use client';

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
import { useTheme } from '../../../context/ThemeContext';

const getCssVar = (name: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

const GlowLine = {
  id: 'glowLine',
  beforeDatasetsDraw(chart: any, _args: any, options: any) {
    const color = options.color || '#ffffff';
    chart.ctx.save();
    chart.ctx.shadowColor = color;
    chart.ctx.shadowBlur = options.blur || 18;
  },
  afterDatasetsDraw(chart: any) {
    chart.ctx.restore();
  },
} as const;

const VerticalLiner = {
  id: 'verticalLiner',
  defaults: {
    width: 1,
    color: 'rgba(255,255,255,0.4)',
    dash: [4, 4],
  },
  afterInit: (chart: any, _args: any, _opts: any) => {
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
  GlowLine,
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
  const { theme } = useTheme(); // subscribe so chart re-renders on theme change
  const greenColor = getCssVar('--green', '#10b981');
  const redColor = getCssVar('--red', '#f43f5e');
  const lineColor = inGreen ? greenColor : redColor;
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
            duration: 400,
            easing: 'easeInOutQuart',
          },
          plugins: {
            // @ts-ignore
            VerticalLiner: {},
            // @ts-ignore
            glowLine: {
              color: lineColor,
              blur: 20,
            },
            legend: {
              display: false,
            },
            title: {
              display: true,
              text: titleText,
              color: 'rgba(255,255,255,0.45)',
              font: {
                size: 11,
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
                title: (_context) => '',
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
              border: { display: false },
              grid: { display: false },
              ticks: {
                source: 'auto',
                autoSkip: true,
                maxTicksLimit: 6,
                display: false,
              },
            },
            y: {
              border: { display: false },
              grid: {
                color: 'rgba(255,255,255,0.05)',
              },
              ticks: {
                source: 'auto',
                autoSkip: true,
                maxTicksLimit: 6,
                color: 'rgba(255,255,255,0.35)',
                font: {},
                callback: (value) => {
                  const val = +value;
                  if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'k';
                  return '$' + val.toFixed(0);
                },
                display: true,
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
              borderColor: lineColor,
              backgroundColor: (context: any) => {
                const chart = context.chart;
                const { ctx, chartArea } = chart;
                if (!chartArea) return 'transparent';
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                const color = lineColor;
                // parse hex to rgb for gradient
                const r = parseInt(color.slice(1, 3), 16) || 0;
                const g = parseInt(color.slice(3, 5), 16) || 0;
                const b = parseInt(color.slice(5, 7), 16) || 0;
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.25)`);
                gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.05)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                return gradient;
              },
              pointRadius: 0,
              tension: 0.3,
              borderWidth: 2,
              pointStyle: 'circle',
              pointBackgroundColor: 'transparent',
              pointBorderColor: 'transparent',
              pointHoverBorderColor: 'transparent',
              fill: true,
            },
          ],
        }}
      />
    </>
  );
};
