import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../db/db';
import { unitToNameMap } from '../../helpers/unitToNameMap';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {

  const { searchTerm } = req.query;
  console.log('search', searchTerm);
  if (!searchTerm || !searchTerm.length) {
    res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const tokenInfos = await db.TokenInfo.findMany({
      take: 10,
      where: {
        OR: [
          {
            name: {
              startsWith: searchTerm,
            },
          },
          {
            symbol: {
              startsWith: searchTerm,
            },
          },
        ],
      },
    });

    return res.status(200).json(tokenInfos);
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal Server Error' });
  }


  // return res.status(200).json(
  //   tokenInfos.map((tokenInfo) => ({
  //     name: tokenInfo.name,
  //     unit: tokenInfo.symbol,
  //     token_id: tokenInfo.token_id,
  //   })),
  // );
}
