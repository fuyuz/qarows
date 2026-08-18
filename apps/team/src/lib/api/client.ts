import { getAcceptLanguageHeader } from "@qarows/shared";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function withAcceptLanguage(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", getAcceptLanguageHeader());
  }
  return { ...init, headers };
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, withAcceptLanguage(init));
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new ApiError(body.error ?? `HTTP ${response.status}`, response.status);
  }
  return body as T;
}

export async function apiText(path: string, init?: RequestInit): Promise<string> {
  const response = await fetch(path, withAcceptLanguage(init));
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? `HTTP ${response.status}`, response.status);
  }
  return response.text();
}
