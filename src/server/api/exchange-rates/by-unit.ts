import type { NextApiRequest, NextApiResponse } from 'next';
import { getExchangeRates } from '../../helpers/get-exchange-rates';
import { db } from '../../db/db';
import { formatUSD } from '../../helpers/format-usd';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<string>,
) {
  const { unit } = req.query;
  // update to latest exchange rates in db
  await getExchangeRates();
  const exchangeRate = await db.exchangeRate.findFirst({
    where: { unit: `${unit}` },
  });

  if (!exchangeRate) {
    return res.status(404).json('Exchange rate not found');
  }

  return res.status(200).json(formatUSD(exchangeRate.rate));
}
