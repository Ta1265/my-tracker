import axios from 'axios';
import { db } from '../db/db';
import moment from 'moment';
import redisClient from '../redisClient';
import { type TimeFrame, type PriceHistoryResp } from '../../../types/global';


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


const minute = 60;
const hour = 60 * minute;
const day = hour * 24;

const cacheExpirationForTimeFrame = {
  h: 10 * minute,
  d: 1 * hour,
  w: 1 * day,
  m: 1 * day,
  '3m': 1 * day,
  '6m': 1 * day,
  y: 1 * day,
  all: 1 * day,
}

const priceHistoryCacheTracker = {
  hit: 0,
  miss: 0,
};


export const getPriceHistoryForTimeFrame = async (coinName: string, timeFrame: TimeFrame): Promise<PriceHistoryResp> => {
  if (
    !coinName ||
    !timeFrame ||
    typeof timeFrame !== 'string' ||
    typeof coinName !== 'string' ||
    !cacheExpirationForTimeFrame[timeFrame]
  ) {
    throw new Error('coinName and timeFrame are required');
  }

  const cacheKey = `time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}`;

  const cacheValue = await redisClient.get(cacheKey);


  if (cacheValue) {
    priceHistoryCacheTracker.hit += 1;
    console.log(`getCoinPriceForTimeFrame cache hit`, priceHistoryCacheTracker);
    return JSON.parse(cacheValue);
  }

  priceHistoryCacheTracker.miss += 1;
  console.log(`getCoinPriceForTimeFrame cache miss ${priceHistoryCacheTracker}`);
  
  const resp = await fetch(
    `https://price-api.crypto.com/price/v2/${timeFrame}/${coinName.toLowerCase()}`,
  );

  if (!resp.ok) {
    throw new Error(`Network response error fetching price history ${resp.statusText}`);
  }

  const res = await resp.json();

  const expiration = cacheExpirationForTimeFrame[timeFrame];

  await redisClient.setex(
    cacheKey,
    expiration,
    JSON.stringify(res),
  );

  return res;
}






