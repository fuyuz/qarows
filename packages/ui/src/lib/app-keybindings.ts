export type AppNavigationPage = "session" | "run" | "matrix" | "dashboard" | "bugs";

/** 画面遷移ショートカット（Cmd/Ctrl + Shift + 文字） */
export const APP_NAV_KEYBINDINGS: Record<AppNavigationPage, string> = {
  run: "r",
  session: "s",
  dashboard: "d",
  bugs: "b",
  matrix: "m",
};

export const APP_NAV_LABELS: Record<AppNavigationPage, string> = {
  run: "テスト実行",
  session: "セッション設定",
  dashboard: "ダッシュボード",
  bugs: "バグ",
  matrix: "マトリクス",
};

/** ShortcutHelp 等での表示順 */
export const APP_NAV_PAGES: AppNavigationPage[] = [
  "run",
  "session",
  "dashboard",
  "bugs",
  "matrix",
];

const PAGE_BY_KEY: Partial<Record<string, AppNavigationPage>> = Object.fromEntries(
  Object.entries(APP_NAV_KEYBINDINGS).map(([page, key]) => [key, page]),
) as Partial<Record<string, AppNavigationPage>>;

export function isKeyboardTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function formatAppNavShortcut(key: string): string {
  const letter = key.toUpperCase();
  return isMacPlatform() ? `⌘⇧${letter}` : `Ctrl+Shift+${letter}`;
}

export function formatAppNavShortcutForPage(page: AppNavigationPage): string {
  return formatAppNavShortcut(APP_NAV_KEYBINDINGS[page]);
}

export function matchAppNavigationPage(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): AppNavigationPage | null {
  if (!event.shiftKey) return null;
  if (!(event.metaKey || event.ctrlKey)) return null;
  if (event.altKey) return null;
  return PAGE_BY_KEY[event.key.toLowerCase()] ?? null;
}
