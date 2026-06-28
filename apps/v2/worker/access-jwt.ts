import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const jwksCache = new Map<string, JWTVerifyGetKey>();

function getAccessJwks(teamDomain: string): JWTVerifyGetKey {
  const cached = jwksCache.get(teamDomain);
  if (cached) return cached;

  const jwks = createRemoteJWKSet(
    new URL(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`),
  );
  jwksCache.set(teamDomain, jwks);
  return jwks;
}

export interface VerifiedAccessIdentity {
  email: string;
}

export async function verifyAccessJwt(
  token: string,
  teamDomain: string,
  audience: string,
): Promise<VerifiedAccessIdentity> {
  const jwks = getAccessJwks(teamDomain);
  const { payload } = await jwtVerify(token, jwks, {
    audience,
    issuer: `https://${teamDomain}.cloudflareaccess.com`,
  });

  const email =
    (typeof payload.email === "string" && payload.email) ||
    (typeof payload.common_name === "string" && payload.common_name) ||
    null;

  if (!email) {
    throw new Error("Access JWT does not contain an email claim");
  }

  return { email };
}
