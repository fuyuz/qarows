/**
 * デプロイ後に古いタブが残ったときの対策。
 *
 * - ビルドごとに `__APP_BUILD_ID__`（vite の define）と同じ値の `/version.json` を出力する
 * - 古いタブで遅延読み込みのチャンクが見つからない（`vite:preloadError`）ときは 1 回だけ自動で再読み込み
 * - 新しいビルドが公開されたことは UpdateAvailableBanner で知らせ、再読み込みはユーザーに任せる
 */

declare const __APP_BUILD_ID__: string | undefined;

const RELOAD_GUARD_KEY = "qarows:stale-chunk-reload-at";
/** これより短い間隔では自動再読み込みを繰り返さない（チャンクが本当に壊れているときの無限ループ防止） */
const RELOAD_GUARD_MS = 30_000;

export function currentBuildId(): string | null {
  return typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : null;
}

export async function fetchLatestBuildId(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { buildId?: unknown };
    return typeof body.buildId === "string" ? body.buildId : null;
  } catch {
    return null;
  }
}

function readGuard(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function writeGuard(value: number): void {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(value));
  } catch {
    // sessionStorage が使えない環境では毎回のガードは効かないが、再読み込み自体は行う
  }
}

export function installStaleChunkReload(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", (event) => {
    if (Date.now() - readGuard() < RELOAD_GUARD_MS) return;
    event.preventDefault();
    writeGuard(Date.now());
    window.location.reload();
  });
}
