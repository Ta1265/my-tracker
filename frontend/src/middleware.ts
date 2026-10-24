import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@portfolio/shared';
import { verifySessionToken } from '@/auth/session';

// Next.js middleware runs on the Edge runtime, which cannot load Node.js-only
// packages such as prom-client, so this file handles auth only and forwards the
// real client IP via a header for downstream server code to log.
function withClientIp(request: NextRequest): NextResponse {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-client-ip', ip);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
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

export const config = { matcher: ['/stats', '/product/:path*', '/stats/:path*'] };
