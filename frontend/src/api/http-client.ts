/**
 * Maps a spec path onto the origin in force. The spec's paths carry the backend's
 * `/backend` prefix; the Next.js routes they coexist with today do not, so `legacy`
 * (the default) strips it before the request is made. `nest` passes the path through
 * unchanged once Epic 7 flips the target. `output.baseUrl` cannot do this rewrite -
 * it only prepends, never strips.
 */
function mapUrl(url: string): string {
  const target = process.env.NEXT_PUBLIC_API_TARGET;
  if (target === 'nest') {
    return url;
  }
  return url.startsWith('/backend') ? url.slice('/backend'.length) : url;
}

async function resolveErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body === 'object' && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // Body was not JSON; fall through to statusText.
  }
  return response.statusText;
}

export async function httpClient<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(mapUrl(url), options);

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
