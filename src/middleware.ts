import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Note: Next.js middleware runs on the Edge runtime, which is incompatible with
// Node.js-only packages (prom-client, winston). HTTP metrics are tracked in
// individual API route handlers instead. This middleware only handles auth and
// forwards the real client IP via a header for downstream server code to log.
export default withAuth(function middleware(request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-client-ip', ip);

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = { matcher: ['/stats', '/product/:path*', '/stats/:path*'] };
