import axios from 'axios';
import { db } from '../db/db';
import moment from 'moment';
import redisClient from '../redisClient';
import { type TimeFrame, type PriceHistoryResp } from '../../../types/global';
import { getPriceHistoryForTimeFrame } from './get-exchange-rates';
import DBService from '../db/dbService';
import { Prisma } from '@prisma/client';


export async function getPriceHistoryMap(userId: number, timeFrame: TimeFrame = 'all', firstTxDate?: moment.Moment) {
  if (!firstTxDate) {
    return [];
  }
  const tokens = await DBService.getTokensForUserId(userId);

  const tokenPriceDates: Array<{
    date: string;
    tokenPricesByInfoId: {
      [token_info_id: string]: { closePrice: number };
    };
  }> = [];


  const dates = new Set<string>();

  await Promise.all(tokens.map(async (token) => {
    const tokenPriceHistory = await getPriceHistoryForTimeFrame(token.coinName, timeFrame);
    tokenPriceHistory.prices.forEach(([unixTimestamp, closePrice]) => {
      // if (moment.unix(unixTimestamp).utc().isBefore(firstTxDate)) {
      //   return;
      // }
      // if (timeFrame === 'all') {
      //   const date = moment.unix(unixTimestamp).utc().format('YYYY-MM-DD');
      //   // if (Number(date.slice(-2)) % 7 !== 1) {
      //   //   return;
      //   // }
      //   // if (dates.has(date)) {
      //   //   return;
      //   // }
      //   // dates.add(date);
      // }
      const date = moment.unix(unixTimestamp).utc().format('YYYY-MM-DD HH:mm:ss');
      const dateEntryIndex = tokenPriceDates.findIndex(entry => entry.date === date);
      if (dateEntryIndex === -1) {
        tokenPriceDates.push({
          date,
          tokenPricesByInfoId: { [token.TokenInfoId]: { closePrice } },
        });
      } else {
        tokenPriceDates[dateEntryIndex].tokenPricesByInfoId[token.TokenInfoId] = { closePrice };
      }
    });
  }));

  return tokenPriceDates.sort((a, b) => moment(a.date).diff(moment(b.date)));
}

export async function getNetCashFlowHistory(userId: number, timeFrame: TimeFrame = 'all') {
  const transactions = await DBService.getBuySellTotalFiFo(userId);
  const firstTxDate = transactions.length ? moment(transactions[0].date).subtract(1, 'day').utc() : undefined;
  const tokenPriceDates = await getPriceHistoryMap(userId, timeFrame, firstTxDate);

  if (!transactions?.length) {
    console.log(`No transactions found for userId ${userId}. Skipping NetCashFlow calculation.`);
    return;
  }

  let netCash = 0; // Tracks remaining cash from sell transactions
  let netContributions = 0; // Tracks total personal funds contributed

  const TokenData: { [unit: string]: { holdings: number; costBasis: number } } = {}; 

  // const netRows: Parameters<typeof DBService.insertIntoNetCashFlow>[0] = [];
  const netRows: Array<{
    date: number;
    valueOfHoldings: number;
    profitLoss: number;
    roi: number;
  }> = [];

  let lowestPointIndex = 0;
  let highestPointIndex = 0; 

  let index = 0;
  tokenPriceDates.forEach(({ date, tokenPricesByInfoId }) => {
    const rowDate = moment(date);
    if (rowDate.isBefore(firstTxDate)) {
      return;
    }

    while (index < transactions.length && moment(transactions[index].date).isSameOrBefore(rowDate)) {
      const tx = transactions[index];
      index += 1;

      if (!TokenData[tx.token_info_id]) {
        TokenData[tx.token_info_id] = { holdings: 0, costBasis: 0 };
      }
      
      if (tx.side?.toUpperCase() === 'SELL') {
        netCash += tx.total;
        TokenData[tx.token_info_id].holdings -= tx.size;
        TokenData[tx.token_info_id].costBasis -= tx.total;
      }
      if (tx.side?.toUpperCase() === 'BUY') {
        TokenData[tx.token_info_id].holdings += tx.size;
        TokenData[tx.token_info_id].costBasis += tx.total;
        if (netCash < tx.total) {
          // deposit the difference
          netContributions += tx.total - netCash;
          netCash = 0;
        } else {
          // pay for purchase with previous sales
          netCash -= tx.total;
        }
      }
    }

    let valueOfHoldings = 0;
    let profitLoss = 0;
    let totalCostBasis = 0

    Object.entries(TokenData).forEach(([tokenInfoId, { holdings, costBasis }]) => {
      const price = tokenPricesByInfoId[tokenInfoId]?.closePrice ?? 0;
      valueOfHoldings += holdings * price;
      profitLoss += (holdings * price) - costBasis;
      totalCostBasis += costBasis;
    });

    const returnOnInvestment = netContributions !== 0 ? (profitLoss / netContributions) * 100 : 0;
    // const rateOfReturn = totalCostBasis !== 0 ? (profitLoss / totalCostBasis) * 100 : 0;

    if (netRows.length && profitLoss < netRows[lowestPointIndex].profitLoss) {
      lowestPointIndex = netRows.length;
    }
    if (netRows.length && profitLoss > netRows[highestPointIndex].profitLoss) {
      highestPointIndex = netRows.length;
    }

    netRows.push({
      date: new Date(date).getTime(),
      valueOfHoldings,
      profitLoss,
      roi: returnOnInvestment
    });
  });

  console.log(`getNetCashFlowHistory generated ${netRows.length} rows for userId ${userId} and timeFrame ${timeFrame}.`);

  return {
    netRows,
    lowestPointIndex,
    highestPointIndex
  }
}


export async function updateNetCashFlowTableData(userId: number, timeFrame: TimeFrame = 'all') {
  const transactions = await DBService.getBuySellTotalFiFo(userId);
  if (!transactions?.length) {
    console.log(`No transactions found for userId ${userId}. Skipping NetCashFlow calculation.`);
    return;
  }

  const tokenInfoIds = Array.from(new Set(transactions.map(tx => tx.token_info_id)));

  const tokenPriceDates = await DBService.getPriceHistoryMap(
    tokenInfoIds,
    timeFrame,
    moment(transactions[0].date).format('YYYY-MM-DD HH:mm:ss'),
  );

  let netCash = 0; // Tracks remaining cash from sell transactions
  let netContributions = 0; // Tracks total personal funds contributed

  const TokenData: { [unit: string]: { holdings: number; costBasis: number } } = {}; 

  const netRows: Parameters<typeof DBService.insertIntoNetCashFlow>[0] = [];

  let index = 0;
  tokenPriceDates.forEach(({ date, tokenPricesByInfoId }) => {
    const rowDate = moment(date);
    // console.log(`Processing date row: ${rowDate.format('YYYY-MM-DD HH:mm:ss')}`);
    const startIndex = index;

    while (index < transactions.length && moment(transactions[index].date).isSameOrBefore(rowDate)) {
      const tx = transactions[index];
      index += 1;

      if (!TokenData[tx.token_info_id]) {
        TokenData[tx.token_info_id] = { holdings: 0, costBasis: 0 };
      }
      
      if (tx.side?.toUpperCase() === 'SELL') {
        netCash += tx.total;
        TokenData[tx.token_info_id].holdings -= tx.size;
        TokenData[tx.token_info_id].costBasis -= tx.total;
      }
      if (tx.side?.toUpperCase() === 'BUY') {
        TokenData[tx.token_info_id].holdings += tx.size;
        TokenData[tx.token_info_id].costBasis += tx.total;
        if (netCash < tx.total) {
          // deposit the difference
          netContributions += tx.total - netCash;
          netCash = 0;
        } else {
          // pay for purchase with previous sales
          netCash -= tx.total;
        }
      }
    }

    const endIndex = index;

    let valueOfHoldings = 0;
    let profitLoss = 0;
    let totalCostBasis = 0

    Object.entries(TokenData).forEach(([tokenInfoId, { holdings, costBasis }]) => {
      const price = tokenPricesByInfoId[tokenInfoId]?.closePrice ?? 0;
      valueOfHoldings += holdings * price;
      profitLoss += (holdings * price) - costBasis;
      totalCostBasis += costBasis;
    });

    const returnOnInvestment = netContributions !== 0 ? (profitLoss / netContributions) * 100 : 0;
    const rateOfReturn = totalCostBasis !== 0 ? (profitLoss / totalCostBasis) * 100 : 0;

    netRows.push({
      userId,
      date,
      totalCostBasis,
      netCash: netCash,
      netContributions,
      valueOfHoldings,
      profitLoss,
      roi: returnOnInvestment.toFixed(2),
      ror: rateOfReturn.toFixed(2),
    });
  });

  await DBService.insertIntoNetCashFlow(netRows);
}

export const syncPriceHistoryToDbForUserId = async (userId: number, timeFrame: TimeFrame = 'all') => {
  const tokens = await DBService.getTokensForUserId(userId);

  console.log(`syncPriceHistoryToDbForUserId found ${tokens.length} tokens for userId ${userId}`);


  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    try {
      console.log(`Fetching price history for ${token.coinName}...`);
      const tokenPriceHistory = await getPriceHistoryForTimeFrame(token.coinName, timeFrame);

      await DBService.insertIntoTokenPriceHistory(tokenPriceHistory.prices.map(([unixTimestamp, closePrice]) => ({
        timeFrame,
        tokenInfoId: token.TokenInfoId,
        closePrice: closePrice.toFixed(2),
        timeStamp: moment.unix(unixTimestamp).utc().format('YYYY-MM-DD HH:mm:ss'),
      })));

    } catch (error) {
      console.error(`Error fetching/storing price history for ${token.coinName}:`, error);
      throw error;
    }
  }
}
