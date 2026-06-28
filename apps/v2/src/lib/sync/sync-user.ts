import { apiJson } from "@/lib/api/client";

interface MeResponse {
  user: { email: string };
}

let cachedUser: string | null = null;

export async function getSyncUser(): Promise<string> {
  if (cachedUser) return cachedUser;
  const data = await apiJson<MeResponse>("/api/me");
  cachedUser = data.user.email;
  return cachedUser;
}
