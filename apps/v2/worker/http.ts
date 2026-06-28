const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
} as const;

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...init.headers,
    },
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, { status });
}

export function notFound(message = "Not found"): Response {
  return errorResponse(message, 404);
}

export function badRequest(message: string): Response {
  return errorResponse(message, 400);
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function readTextBody(request: Request): Promise<string | null> {
  try {
    const text = await request.text();
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}
