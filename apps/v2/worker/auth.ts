export interface AuthUser {
  email: string;
}

/** Cloudflare Access in production; X-Qarows-User header for local dev. */
export function getAuthUser(request: Request): AuthUser {
  const accessEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (accessEmail) return { email: accessEmail };

  const devUser = request.headers.get("X-Qarows-User");
  if (devUser) return { email: devUser };

  return { email: "dev@local" };
}
