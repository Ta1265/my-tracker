// import { readCSV } from '../../utils/read-csv';
import unitToNameMap from '../../data/coinsUnitToNameMap';
import { db } from './db';

// const getTransactions = async (): Promise<Transaction[]> => {
//   return readCSV('src/data/transactions.csv').then((results) =>
//     results.filter(
//       (result) =>
//         new Date(result.date).getTime() >
//         new Date('2021-01-01T00:00:00').getTime(),
//     ),
//   );
// };

// export const storeTransactions = async () => {
//   const transactions = await getTransactions();

//   return Promise.all(
//     transactions.map(async (transaction) => {
//       await db.transaction.create({
//         data: {
//           product: transaction.product,
//           date: transaction.date,
//           side: transaction.side,
//           size: parseFloat(transaction.size),
//           unit: transaction.unit,
//           price: parseFloat(transaction.price),
//           fee: parseFloat(transaction.fee),
//           total: parseFloat(transaction.total),
//           notes: transaction.notes,
//         },
//       });
//     }),
//   )
//     .then((result) => console.log('finished storing transactions', result))
//     .catch((error) => console.error('error storing transactions', error));
// };

export const setTransactionNames = async () => {
  const transactions = await db.transaction.findMany();

  return Promise.all(
    transactions.map(async (transaction) => {
      await db.$queryRaw<any>`
        UPDATE Transaction
        SET coinName = ${unitToNameMap[transaction.unit.toLowerCase()]
          .replace(/\(.*?\)/g, '')
          .trim()
          .replace(/\s/g, '-')}
        WHERE id = ${transaction.id}
      `;
    }),
  )
    .then((result) => console.log('finished setting transaction names', result))
    .catch((error) => console.error('error setting transaction names', error));
};
