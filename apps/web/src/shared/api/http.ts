import { apiErrorSchema } from '@harness/contracts';

const defaultFallback = 'The operation could not be completed.';

interface ResponseSchema<T> {
  parse(value: unknown): T;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    return new Error(parsed.success ? parsed.data.error : fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function requestJson<T>(
  url: string,
  schema: ResponseSchema<T>,
  init: RequestInit = {},
  fallback = defaultFallback,
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw await responseError(response, fallback);
  return schema.parse(await response.json());
}

export async function requestVoid(
  url: string,
  init: RequestInit,
  fallback = defaultFallback,
): Promise<void> {
  const response = await fetch(url, init);
  if (!response.ok) throw await responseError(response, fallback);
}

export function jsonBody(value: unknown): RequestInit {
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) };
}
