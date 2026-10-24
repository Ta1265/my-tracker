// Carries the status so callers can tell a final 4xx answer from a transient failure;
// a bare Error would collapse that distinction into a message string.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
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
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new HttpError(response.status, await resolveErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
