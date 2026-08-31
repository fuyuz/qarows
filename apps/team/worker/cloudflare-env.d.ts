/* eslint-disable */
/**
 * Worker の Env 型。手書きで管理する。
 *
 * `wrangler types` の出力では代用できない: wrangler は渡された 1 つの構成しか
 * 知らないので全バインディングを必須で出力するが、この Worker は AI・R2・
 * メール許可リストを積まないデプロイも成立し、コード側が env.AI / env.ATTACHMENTS
 * の有無を見て機能を出し入れしている。
 *
 * wrangler.toml.example にバインディングを足したらここにも足すこと。
 * ズレの検出: bun run --filter @qarows/team check:worker-env
 */
declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    PROJECT: DurableObjectNamespace;
    AI?: Ai;
    ATTACHMENTS?: R2Bucket;
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD?: string;
    ACCESS_ALLOWED_EMAIL_DOMAIN?: string;
    ACCESS_ALLOWED_EMAILS?: string;
    AUTH_DEV_BYPASS?: string;
    AI_MODEL?: string;
    AI_MODEL_FALLBACK?: string;
  }
}

interface CloudflareEnv extends Cloudflare.Env {}
