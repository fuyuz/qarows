// Copy to cloudflare.config.ts (gitignored) and fill in before deploy:
//   cp cloudflare.config.example.ts cloudflare.config.ts
import { bindings, defineConfig, exports } from "cf/config";

// カスタムドメイン（任意）。例: ["qarows.example.com"]。Access Application にもこのホストを含めること
const CUSTOM_DOMAINS: string[] = [];

// mode は `bun run deploy:team`（cf deploy --mode production）のときだけ "production"。
// cf dev では undefined になる
export default defineConfig(({ mode }) => ({
	// Or set CLOUDFLARE_ACCOUNT_ID instead
	accountId: "YOUR_ACCOUNT_ID",
	worker: {
		name: "qarows-v2",
		compatibilityDate: "2026-06-28",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "worker/index.ts",
		// カスタムドメインで運用するなら false にして workers.dev のオリジンを露出させない。
		// true にする場合は、Access Application に *.workers.dev のホストも
		// 含めること（docs/deploy-team.md 4.3）。含め忘れると JWT なしで直接叩ける
		workersDev: false,
		// ローカル開発では付けない: 付けると cf dev でもリクエストの URL がこのドメインになり、
		// localhost:8787 限定の AUTH_DEV_BYPASS が効かず API がすべて 401 になる
		domains: mode === "production" ? CUSTOM_DOMAINS : [],
		observability: {
			enabled: true,
			// 全リクエストのログを保持する。エラーログには YAML の parse エラーなど
			// プロジェクトの内容が混ざりうる（ログは自分の Cloudflare アカウント内）
			logs: { headSamplingRate: 1 },
			traces: { enabled: true, headSamplingRate: 0.01 },
		},
		assets: {
			notFoundHandling: "single-page-application",
		},
		env: {
			// Access JWT is always enforced on deployed hosts.
			// AUTH_DEV_BYPASS is only honored for local dev (localhost/127.0.0.1:8787) via .dev.vars.
			// Zero Trust team name (https://<ACCESS_TEAM_DOMAIN>.cloudflareaccess.com)
			ACCESS_TEAM_DOMAIN: bindings.text("your-team-name"),
			// Access Application AUD tag — see docs/deploy-team.md §4.4 (not auto-injected by Cloudflare)
			ACCESS_AUD: bindings.text("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),

			// Worker-side allow guard (choose Method A or B in Access policy + mirror here):
			// Method B — organization domain:
			// ACCESS_ALLOWED_EMAIL_DOMAIN: bindings.text("example.com"),
			// Method A — named individuals (comma-separated):
			// ACCESS_ALLOWED_EMAILS: bindings.text("alice@example.com,bob@example.com"),

			// Optional: MCP server (docs/deploy-team.md §6). A dedicated hostname, also listed in
			// CUSTOM_DOMAINS, protected by its own Access application with Managed OAuth.
			// MCP_HOSTNAME: bindings.text("qarows-mcp.example.com"),
			// MCP_ACCESS_AUD: bindings.text("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),

			// Optional: AI-assisted tests.yml editing (UI + API appear when bound)
			// AI: bindings.ai(),
			// Prefer json_schema-capable models (see Workers AI JSON Mode docs).
			// AI_MODEL: bindings.text("@cf/openai/gpt-oss-120b"),
			// AI_MODEL_FALLBACK: bindings.text("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
			// Strongly recommended when AI is enabled: without it the propose limit is
			// per-isolate, so the effective ceiling is undefined and Workers AI usage is
			// unbounded. Counted per Cloudflare location, not globally.
			// AI_RATE_LIMIT: bindings.rateLimit({ namespace: "1001", simple: { limit: 20, period: 60 } }),

			// `cf d1 create --name qarows-v2` の出力の uuid を id に入れる。
			// ローカル開発だけなら仮の UUID のままでよい（ローカル D1 はこの id で区別される）
			DB: bindings.d1({ name: "qarows-v2", id: "11111111-1111-4111-8111-111111111111" }),

			// Optional: bug attachments (images/videos stored in R2).
			// Create the bucket first: cf r2 buckets create --name qarows-team-attachments
			// Remove this binding to disable attachments (UI hides the feature).
			ATTACHMENTS: bindings.r2({ name: "qarows-team-attachments" }),

			// worker は上の worker.name と揃える
			PROJECT: bindings.durableObject({ worker: "qarows-v2", exportName: "ProjectRoom" }),
			ASSETS: bindings.assets(),
		},
		exports: {
			ProjectRoom: exports.durableObject({ storage: "sqlite" }),
		},
	},
}));
