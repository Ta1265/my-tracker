export type PortfolioSummary = {
  purchases: number;
  sales: number;
  costBasis: number;
  valueOfHoldings: number;
  totalPLatCurrentPrice: number;
  netCashHoldings: number;
  netContributions: number;
  accountValue: number;
  realizedReturn: number;
  roi: number;
  inGreen: boolean;
};

export type CoinSummaryResp = {
  productName: string;
  coinName: string;
  avgPurchasePrice: number;
  avgSellPrice: number;
  holdings: number;
  valueOfHoldings: number;
  profitLossAtCurrentPrice: number;
  percentPL: number;
  currentPrice: number;
  breakEvenPrice: number;
  inGreen: boolean;
  costBasis: number;
  totalBuyCost: number;
  totalSellProfits: number;
  netContributions: number;
  netCashHoldings: number;
};

type PriceHistoryResp = {
  prices: Array<[unixTimestamp: number, openPrice: number, closePrice: number]>;
  price_change: number;
  usd_price_change: number;
};

interface TimeFramePlByUnitResp {
  [unit: string]: {
    pastPl: number;
    curPl: number;
    timeFrameStartPrice: number;
  }
}

interface TimeFrameTotalPlResp {
  totalPastPl: number;
  totalCurPl: number;
  pastTotalValue: number;
  currentTotalValue: number;
}

export type TimeFrame = 'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all';

export type ProductTransaction = {
  id: number;
  fullName: string;
  product: string;
  date: string;
  side: string;
  size: string;
  unit: string;
  price: string;
  fee: string;
  total: string;
  notes: string;
  runningBalance: string;
  runningCostBasis: string;
  realizedGains: {
    total: number;
    short: number;
    long: number;
  };
}