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
    // Access の JWKS は RS256 のみ。createRemoteJWKSet は JWK の alg でも候補を絞るが、
    // alg を持たない JWKS になった場合に token 任せにならないよう明示する（多層防御）
    algorithms: ["RS256"],
  });

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!email) {
    throw new Error("Access JWT does not contain an email claim");
  }

  return { email };
}
