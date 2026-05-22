import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/server/auth';
import { db } from '@/server/db/db';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });

  try {
    await db.transaction.delete({ where: { id: parseInt(id, 10) } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: 'An error occurred while deleting the transaction' }, { status: 500 });
  }
}
