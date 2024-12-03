export type PortfolioSummary = {
  purchases: string;
  sales: string;
  costBasis: string;
  valueOfHoldings: string;
  totalPLatCurrentPrice: string;
  netCashHoldings: string;
  netContributions: string;
  accountValue: string;
  realizedReturn: string;
  roi: string;
  inGreen: boolean;
};

export type CoinSummaryResp = {
  productName: string;
  coinName: string;
  avgPurchasePrice: string;
  avgSellPrice: string;
  holdings: string;
  valueOfHoldings: string;
  profitLossAtCurrentPrice: string;
  percentPL: string;
  currentPrice: string;
  breakEvenPrice: string;
  inGreen: boolean;
  costBasis: number;
  totalBuyCost: number;
  totalSellProfits: number;
  netContributions: number;
};
