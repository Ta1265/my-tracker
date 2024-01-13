import type { NextApiRequest, NextApiResponse } from 'next';
// import { readCSV } from "../../../utils/read-csv";
// import csv from "csv-parser";
// import fs from "fs";
import axios from 'axios';
import type { Transaction } from '@prisma/client';
import { db } from '../../db/db';
import { unitToNameMap } from '../../helpers/unitToNameMap';
import { getServerAuthSession } from '../../auth';

const getExchangeRates = async (): Promise<ExchangeRates> => {
  return axios
    .get('https://api.coinbase.com/v2/exchange-rates')
    .then((resp) => resp.data.data.rates);
};

// const getTransactions = async (): Promise<Transaction[]> => {
//   return readCSV("src/data/transactions.csv").then((results) =>
//     results.filter(
//       (result) =>
//         new Date(result.date).getTime() >
//         new Date("2021-01-01T00:00:00").getTime()
//     )
//   );
// }

const formatUSD = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const formatTransactions = (transactions: Transaction[]) =>
  transactions.map((transaction) => ({
    fullName: transaction.coinName, //unitToNameMap[transaction.unit],
    product: transaction.product,
    date: new Date(transaction.date).toLocaleString(),
    side: transaction.side,
    size: transaction.size.toFixed(4),
    unit: transaction.unit,
    price: formatUSD(transaction.price),
    fee: formatUSD(transaction.fee),
    total: formatUSD(transaction.total),
    notes: transaction.notes,
  }));

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  const session = await getServerAuthSession({ req, res });
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  const { product } = req.query;

  // let transactions = await getTransactions();

  const transactions = await db.transaction.findMany({
    where: { product: `${product}-USD`, userId },
    orderBy: { date: 'desc' },
  });

  const formattedTransactions = formatTransactions(transactions);

  return res.status(200).json(formattedTransactions);
}
