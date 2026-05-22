'use client';

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
import { useTheme } from '../../context/ThemeContext';

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
  GlowLine,
);

interface Props {
}

export const LineChart: React.FC<Props> = () => {
  const { unit, setHoveringChart, timeFrame, setHoverPrice, priceData, priceChange } = usePriceHistory();
  const { theme } = useTheme(); // subscribe so chart re-renders on theme change
  const greenColor = getCssVar('--green', '#10b981');
  const redColor = getCssVar('--red', '#f43f5e');
  const lineColor = priceChange > 0 ? greenColor : redColor;

  const tfSettings = timeFrameSettingsMap[timeFrame];

  return (
    <>
      <Line
        style={{ touchAction: 'none' }}
        onMouseLeave={() => setHoveringChart(false)}
        onMouseEnter={() => setHoveringChart(true)}
        options={{
          responsive: true,
          animation: {
            duration: 400,
            easing: 'easeInOutQuart',
          },
          plugins: {
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
              text: tfSettings.titleText,
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
                displayFormats: {
                  minute: 'h:mm a',
                  hour: 'h:mm a',
                  day: 'MMM-DD-YY',
                },
              },
              border: { display: false },
              grid: {
                display: false,
              },
              ticks: {
                source: 'auto',
                autoSkip: true,
                maxTicksLimit: 6,
                color: 'rgba(255,255,255,0.35)',
                font: {
                  size: window?.innerWidth < 768 ? 10 : 12,
                },
                display: true,
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
                font: {
                  size: window?.innerWidth < 768 ? 10 : 12,
                },
                callback: (value) => {
                  const val = +value;
                  if (val >= 1000) {
                    return '$' + (val / 1000).toFixed(1) + 'k';
                  } else {
                    return '$' + val.toFixed(0);
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
              borderColor: lineColor,
              backgroundColor: (context: any) => {
                const chart = context.chart;
                const { ctx, chartArea } = chart;
                if (!chartArea) return 'transparent';
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                const color = lineColor;
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
              fill: true,
            },
          ],
        }}
      />
    </>
  );
};
  