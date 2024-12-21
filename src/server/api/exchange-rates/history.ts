import type { NextApiRequest, NextApiResponse } from 'next';
import { getPriceHistoryForTimeFrame } from '../../helpers/get-exchange-rates';
import { type TimeFrame, type PriceHistoryResp } from '../../../../types/global';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PriceHistoryResp | { error: string }>,
) {
  const timeFrame = req.query.timeFrame as TimeFrame;
  const coinName = req.query.coinName as string;

  if (typeof timeFrame !== 'string' || typeof coinName !== 'string') {
    return res.status(400).json({ error: 'Invalid query' });
  }

  const priceData = await getPriceHistoryForTimeFrame(coinName, timeFrame);

  return res.status(200).json(priceData);
}
