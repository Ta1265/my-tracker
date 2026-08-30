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
    throw new Error(await resolveErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
