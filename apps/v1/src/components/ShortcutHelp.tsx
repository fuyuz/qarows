import { formatRunnerKeys, RUNNER_KEYBINDINGS } from "@/lib/runner-keybindings";

const SHORTCUT_ROWS = [
  { label: "前のテスト", keys: RUNNER_KEYBINDINGS.prev },
  { label: "次のテスト", keys: RUNNER_KEYBINDINGS.next },
  { label: "一括 OK", keys: RUNNER_KEYBINDINGS.ok },
  { label: "一括 NG", keys: RUNNER_KEYBINDINGS.ng },
  { label: "一括 SKIP", keys: RUNNER_KEYBINDINGS.skip },
] as const;

export function ShortcutHelp() {
  return (
    <div className="shortcut-help">
      <button
        type="button"
        className="shortcut-help__trigger"
        aria-label="キーボードショートカット"
        aria-describedby="shortcut-help-panel"
      >
        ?
      </button>
      <div id="shortcut-help-panel" className="shortcut-help__panel" role="tooltip">
        <p className="shortcut-help__title">キーボードショートカット</p>
        <dl className="shortcut-help__list">
          {SHORTCUT_ROWS.map((row) => (
            <div key={row.label} className="shortcut-help__row">
              <dt>{row.label}</dt>
              <dd>
                <kbd className="kbd">{formatRunnerKeys(row.keys)}</kbd>
              </dd>
            </div>
          ))}
        </dl>
        <p className="shortcut-help__note">メモ入力中は無効</p>
      </div>
    </div>
  );
}
