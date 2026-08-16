import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db/db';

export async function GET(_req: NextRequest, { params }: { params: { searchTerm: string } }) {
  const { searchTerm } = params;
  if (!searchTerm?.length) {
    return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
  }

  try {
    const tokenInfos = await db.tokenInfo.findMany({
      take: 10,
      where: {
        OR: [
          { name: { startsWith: searchTerm } },
          { symbol: { startsWith: searchTerm } },
        ],
      },
    });
    return NextResponse.json(tokenInfos);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
