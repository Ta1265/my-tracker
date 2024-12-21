type Transaction = {
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
};

type ProductStats = {
  productName: string;
  coinName: string;
  countBuys: number;
  countSells: number;
  totalBuyQuantity: number;
  totalSellQuantity: number;
  totalBuyCost: number;
  totalSellProfits: number;
  avgPurchasePrice: number;
  profitLoss: number;
  holdings: number;
  valueOfHoldings: number;
  profitLossAtCurrentPrice: number;
  percentPL: number;
  currentPrice: number;
  breakEvenPrice: number;
  history: {
    oneDay: number;
    sevenDay: number;
    thirtyDay: number;
  };
};
type StatsSummary = {
  initialInvestment: string;
  proceedsFromSales: string;
  costBasis: string;
  totalValueOfHoldings: string;
  totalPLatCurrentPrice: string;
  totalPercentPL: string;
  totalGrowth: string;
  roi: string;
  cash: string;
};

type FormattedProductStats = {
  coinName: string;
  productName: string;
  avgPurchasePrice: string;
  avgSellPrice: string;
  holdings: string;
  valueOfHoldings: string;
  profitLossAtCurrentPrice: string;
  percentPL: string;
  currentPrice: string;
  breakEvenPrice: string;
};

type ExchangeRates = {
  [key: string]: number;
};

