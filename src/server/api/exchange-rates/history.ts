import type { NextApiRequest, NextApiResponse } from 'next';
import { getExchangeRates } from '../../helpers/get-exchange-rates';
import { db } from '../../db/db';
import { formatUSD } from '../../helpers/format-usd';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  const { timeFrame, coinName } = req.query;

  const priceData = await axios
    .get(
      `https://price-api.crypto.com/price/v2/${timeFrame}/${coinName.toLowerCase()}`,
    )
    .then((resp) => {
      return resp.data;
    });

  return res.status(200).json(priceData);
}
