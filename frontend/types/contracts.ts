// The only file in this repo that imports `components`/`paths` from the generated
// `./api`. Every consumer imports its DTO shape from here instead, by the backend
// class name verbatim.
import type { components, paths } from './api';

export type PortfolioSummaryResponseDto = components['schemas']['PortfolioSummaryResponseDto'];
export type CoinSummaryResponseDto = components['schemas']['CoinSummaryResponseDto'];
export type PriceHistoryResponseDto = components['schemas']['PriceHistoryResponseDto'];
export type TimeFrameTotalPlResponseDto = components['schemas']['TimeFrameTotalPlResponseDto'];
export type ProductTransactionResponseDto = components['schemas']['ProductTransactionResponseDto'];
export type ProfitLossChartResponseDto = components['schemas']['ProfitLossChartResponseDto'];
export type LoginResponseDto = components['schemas']['LoginResponseDto'];
export type TimeFrame = components['schemas']['TimeFrame'];

// No component schema of its own - an arbitrary-key map has nothing to decorate, so
// the shape only exists on the response of the one route that returns it.
export type TimeFrameCoinsPlResponseDto =
  paths['/backend/api/time-frame-coins-pl/{timeFrame}']['get']['responses'][200]['content']['application/json'];
