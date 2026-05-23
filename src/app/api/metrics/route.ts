import { type NextRequest, NextResponse } from 'next/server';
import { register } from '../../../server/metrics';

// Never cache the metrics scrape response
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.METRICS_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const metrics = await register.metrics();

  return new NextResponse(metrics, {
    status: 200,
    headers: {
      'Content-Type': register.contentType,
    },
  });
}
