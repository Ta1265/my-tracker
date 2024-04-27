import { NextApiRequest, NextApiResponse } from 'next';
import { getServerAuthSession } from '../../auth';
import { db } from '../../db/db';

// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponse<any>,
// ) {
//   if (req.method === 'DELETE') {
//     await handleDeleteTransaction(req, res);
//   } else {
//     res.status(405).end(`Method ${req.method} Not implemented`);
//   }

// }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  if (req.method !== 'DELETE') {
    return res.status(405).end(`Method ${req.method} Not implemented`);
  }

  const session = await getServerAuthSession({ req, res });

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query as { id: string };

  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }

  try {
    await db.transaction.delete({
      where: { id: parseInt(id, 10) },
    });
    return res.status(204).end();
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'An error occurred while deleting the transaction' });
  }
}