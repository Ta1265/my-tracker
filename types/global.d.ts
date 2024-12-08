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
