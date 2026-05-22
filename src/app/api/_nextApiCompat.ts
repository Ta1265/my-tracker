import type { NextApiRequest, NextApiResponse } from 'next';
import { type NextRequest } from 'next/server';

/**
 * Wraps a legacy NextApiHandler so it can be called from an App Router route handler.
 * Returns a Response.
 */
export async function runLegacyHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  nextReq: NextRequest,
  params?: Record<string, string>,
): Promise<Response> {
  let status = 200;
  let body: any = null;
  const headers: Record<string, string> = {};

  const url = new URL(nextReq.url);
  const query: Record<string, string> = params ? { ...params } : {};
  url.searchParams.forEach((v, k) => { query[k] = v; });

  let reqBody: any = undefined;
  const contentType = nextReq.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { reqBody = await nextReq.json(); } catch {}
  }

  const req = {
    method: nextReq.method,
    query,
    body: reqBody,
    headers: Object.fromEntries(nextReq.headers.entries()),
    cookies: Object.fromEntries(
      (nextReq.headers.get('cookie') || '')
        .split(';')
        .filter(Boolean)
        .map((c) => c.trim().split('=').map(decodeURIComponent) as [string, string])
    ),
    // Minimal NextApiRequest compatibility — add more fields if handlers need them
  } as unknown as NextApiRequest;

  const res = {
    status: (s: number) => { status = s; return res; },
    json: (b: any) => { body = b; headers['content-type'] = 'application/json'; return res; },
    send: (b: any) => { body = b; return res; },
    end: (b?: any) => { if (b) body = b; return res; },
    setHeader: (k: string, v: string | string[]) => {
      headers[k] = Array.isArray(v) ? v.join(', ') : v;
      return res;
    },
  } as unknown as NextApiResponse;

  await handler(req, res);

  const responseBody =
    headers['content-type'] === 'application/json'
      ? JSON.stringify(body)
      : body ?? '';

  return new Response(responseBody, { status, headers });
}
