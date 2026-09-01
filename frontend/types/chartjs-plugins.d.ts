import 'chart.js';

// Options for the custom verticalLiner/glowLine plugins registered in the chart components;
// the keys must stay in sync with each plugin's `id`.
declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    verticalLiner: {
      width?: number;
      color?: string;
      dash?: number[];
    };
    glowLine: {
      color?: string;
      blur?: number;
    };
  }
}
