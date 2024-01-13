import type { NextApiRequest, NextApiResponse } from 'next';
import { getExchangeRates } from '../../helpers/get-exchange-rates';
import { db } from '../../db/db';
import { formatUSD } from '../../helpers/format-usd';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  const { unit } = req.query;
  // update to latest exchange rates in db
  await getExchangeRates();
  const { rate } = await db.exchangeRate.findFirst({
    where: { unit: `${unit}` },
  });

  return res.status(200).json(formatUSD(rate));
}
