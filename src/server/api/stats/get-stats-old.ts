// // Next.js API route support: https://nextjs.org/docs/api-routes/introduction
// import type { NextApiRequest, NextApiResponse } from 'next';
// import { db } from '../../db/db';
// import type { Transaction } from '@prisma/client';
// import { getExchangeRates } from '../../helpers/get-exchange-rates';
// import { unitToNameMap } from '../../helpers/unitToNameMap';
// import { formatUSD } from '../../helpers/format-usd';

// async function getProductStats(rates: ExchangeRates, productName: string) {
//   const allTransactions = await db.transaction.findMany({
//     where: { product: productName },
//   });
//   const aMatchingTransaction = allTransactions[0];

//   if (!aMatchingTransaction) {
//     throw new Error('No matching transaction found');
//   }

//   const unit = aMatchingTransaction.unit;

//   const currentPrice = 1 / rates[unit];

//   let countBuys = 0;
//   let countSells = 0;
//   let totalBuyQuantity = 0;
//   let totalSellQuantity = 0;
//   let totalBuyCost = 0;
//   let totalSellProfits = 0;

//   for (let i = 0; i < allTransactions.length; i++) {
//     if (allTransactions[i].side === 'BUY') {
//       countBuys += 1;
//       totalBuyQuantity += allTransactions[i].size;
//       totalBuyCost -= allTransactions[i].total;
//     } else {
//       countSells += 1;
//       totalSellQuantity += allTransactions[i].size;
//       totalSellProfits += allTransactions[i].total;
//     }
//   }

//   const holdings = totalBuyQuantity - totalSellQuantity;
//   const valueOfHoldings = holdings * currentPrice;
//   const avgPurchasePrice = totalBuyCost / totalBuyQuantity;
//   const avgSellPrice = totalSellProfits / totalSellQuantity;
//   const profitLoss = totalSellProfits - totalBuyCost;
//   const profitLossAtCurrentPrice =
//     totalSellProfits - totalBuyCost + valueOfHoldings;
//   const breakEvenPrice = -1 * ((totalSellProfits - totalBuyCost) / holdings);
//   const percentPL = (profitLossAtCurrentPrice / totalBuyCost) * 100;

//   const coinName = unitToNameMap[unit];

//   return {
//     productName,
//     coinName,
//     countBuys,
//     countSells,
//     totalBuyQuantity,
//     totalSellQuantity,
//     totalBuyCost,
//     totalSellProfits,
//     avgPurchasePrice,
//     profitLoss,
//     holdings,
//     valueOfHoldings,
//     profitLossAtCurrentPrice,
//     percentPL,
//     currentPrice,
//     breakEvenPrice,
//     // history: {
//     //   oneDay,
//     //   sevenDay,
//     //   thirtyDay,
//     // }
//   };
// }

// const formatStats = (stats: any[]) =>
//   stats.map((stat) => ({
//     productName: stat.productName.split('-')[0],
//     // coinName: stat.coinName.charAt(0).toUpperCase() + stat.coinName.slice(1),
//     // countBuys: stat.countBuys,
//     // countSells: stat.countSells,
//     // totalBuyQuantity: stat.totalBuyQuantity.toFixed(4),
//     // totalSellQuantity: stat.totalSellQuantity.toFixed(4),
//     // totalBuyCost: formatUSD(stat.totalBuyCost),
//     // totalSellProfits: formatUSD(stat.totalSellProfits),
//     avgPurchasePrice: formatUSD(stat.avgPurchasePrice),
//     // avgSellPrice: formatUSD(stat.avgSellPrice),
//     // 'Profit/Loss': formatUSD(stat.profitLoss),
//     holdings: stat.holdings.toFixed(4),
//     valueOfHoldings: formatUSD(stat.valueOfHoldings),
//     profitLossAtCurrentPrice: formatUSD(stat.profitLossAtCurrentPrice),
//     percentPL: stat.percentPL.toFixed(1) + '%',
//     currentPrice: formatUSD(stat.currentPrice),
//     breakEvenPrice: formatUSD(stat.breakEvenPrice),
//     // history: JSON.stringify({
//     //   oneDay: formatUSD(stat.history.oneDay),
//     //   sevenDay: formatUSD(stat.history.sevenDay),
//     //   thirtyDay: formatUSD(stat.history.thirtyDay),
//     // })
//   }));

// const getStatsSummary = (stats: any[]) => {
//   const totalValueOfHoldings = stats.reduce(
//     (acc, { valueOfHoldings }) => acc + valueOfHoldings,
//     0,
//   );
//   const totalPLatCurrentPrice = stats.reduce(
//     (acc, { profitLossAtCurrentPrice }) => acc + profitLossAtCurrentPrice,
//     0,
//   );
//   const totalPercentPL = (totalPLatCurrentPrice / totalValueOfHoldings) * 100;

//   return [
//     {
//       totalValueOfHoldings: formatUSD(totalValueOfHoldings),
//       totalPLatCurrentPrice: formatUSD(totalPLatCurrentPrice),
//       totalPercentPL: totalPercentPL.toFixed(2) + '%',
//     },
//   ];
// };

// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponse<any>,
// ) {
//   const rates = await getExchangeRates();

//   const uniqueProductNames = await db.transaction.findMany({
//     select: { product: true },
//     distinct: ['product'],
//   });

//   const stats = await Promise.all(
//     uniqueProductNames.map(({ product }) => getProductStats(rates, product)),
//   );

//   stats.sort((a, b) => b.valueOfHoldings - a.valueOfHoldings);

//   res.status(200).json({
//     stats: formatStats(stats),
//     summary: getStatsSummary(stats),
//   });
// }
