import axios from 'axios';
import { db } from '../db/db';
import moment from 'moment';

export const getExchangeRates = async () => {
  // fetch exchange rates from coinbase

  let rates = await axios
    .get('https://api.coinbase.com/v2/exchange-rates')
    .then((resp): ExchangeRates => resp.data.data.rates);

  // get a list of all currencies that are held in the portfolio
  const heldCurrencies = await db.$queryRaw<
    Transaction[]
  >`SELECT DISTINCT unit FROM PORTFOLIO.Transaction`.then((results) =>
    results.map(({ unit }) => unit),
  );

  // filter out any currencies that are not held in the portfolio
  const rows = Object.entries(rates)
    .map(([unit, rate]) => ({
      unit,
      rate: 1 / rate,
    }))
    .filter(({ unit }) => heldCurrencies.includes(unit));

  const nowDate = moment().toDate();

  // upsert the latest exchange rates into the database
  await Promise.all(
    rows.map(
      ({ unit, rate }) =>
        db.$queryRaw<any>`
          INSERT INTO ExchangeRate (date, unit, rate)
          VALUES (${nowDate}, ${unit}, ${rate})
          ON DUPLICATE KEY UPDATE date = VALUES(date), rate = VALUES(rate)
        `,
    ),
  );

  // return the exchange rates in case they are needed elsewhere
  return rates;
};
