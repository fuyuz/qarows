import { describe, expect, it } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { verifyAccessJwt } from "./access-jwt";

const AUD = "aud-tag";

function issuerFor(teamDomain: string): string {
  return `https://${teamDomain}.cloudflareaccess.com`;
}

/**
 * JWKS の fetch を差し替える。team domain ごとにキャッシュされるので、
 * テストごとに別の team 名を使って必ず自分の鍵を引かせる
 */
async function withJwks<T>(jwk: unknown, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ keys: [jwk] }), {
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

describe("verifyAccessJwt", () => {
  it("accepts an RS256 token and returns the email", async () => {
    const team = "team-rs256";
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({ email: "qa@example.com" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(issuerFor(team))
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(privateKey);

    const identity = await withJwks({ ...(await exportJWK(publicKey)), alg: "RS256" }, () =>
      verifyAccessJwt(token, team, AUD),
    );
    expect(identity.email).toBe("qa@example.com");
  });

  it("rejects a non-RS256 token even when the JWKS omits alg", async () => {
    // JWK に alg があれば createRemoteJWKSet 側でも弾かれる。alg なしの JWKS が
    // 相手だと token の alg 任せになるので、そこを allowlist で止める
    const team = "team-no-alg";
    const { publicKey, privateKey } = await generateKeyPair("PS256");
    const token = await new SignJWT({ email: "attacker@example.com" })
      .setProtectedHeader({ alg: "PS256" })
      .setIssuer(issuerFor(team))
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(privateKey);

    const jwk = await exportJWK(publicKey);
    await expect(
      withJwks(jwk, () => verifyAccessJwt(token, team, AUD)),
    ).rejects.toThrow(/not allowed/);
  });

  it("rejects a token without an email claim", async () => {
    const team = "team-noemail";
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(issuerFor(team))
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(privateKey);

    await expect(
      withJwks({ ...(await exportJWK(publicKey)), alg: "RS256" }, () =>
        verifyAccessJwt(token, team, AUD),
      ),
    ).rejects.toThrow(/email/);
  });
});
