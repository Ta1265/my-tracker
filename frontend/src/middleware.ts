import { withAuth } from 'next-auth/middleware';
import type { NextRequestWithAuth } from 'next-auth/middleware';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@portfolio/shared';
import { getAuthTarget } from '@/auth/target';
import { verifySessionToken } from '@/server/session';

// Note: Next.js middleware runs on the Edge runtime, which is incompatible with
// Node.js-only packages (prom-client, winston). HTTP metrics are tracked in
// individual API route handlers instead. This middleware only handles auth and
// forwards the real client IP via a header for downstream server code to log.
function withClientIp(request: NextRequest): NextResponse {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-client-ip', ip);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

const legacyMiddleware = withAuth(function middleware(request) {
  return withClientIp(request);
});

async function nestMiddleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      await verifySessionToken(token, process.env.SESSION_PUBLIC_KEY_JWK!);
      return withClientIp(request);
    } catch {
      // fall through to the redirect below
    }
  }

  const signInUrl = new URL('/login', request.url);
  signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signInUrl);
}

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (getAuthTarget() === 'nest') {
    return nestMiddleware(request);
  }
  // withAuth's own runtime attaches `nextauth` to the request before invoking the
  // wrapped middleware; the type only exists to document that, not to require it here.
  return legacyMiddleware(request as NextRequestWithAuth, event);
}

export const config = { matcher: ['/stats', '/product/:path*', '/stats/:path*'] };
