import { formatRunnerKeys, RUNNER_KEYBINDINGS } from "@/lib/runner-keybindings";
import { Kbd } from "@/components/qa-ui";
import { Button } from "@/components/ui/button";

const SHORTCUT_ROWS = [
  { label: "前のテスト", keys: RUNNER_KEYBINDINGS.prev },
  { label: "次のテスト", keys: RUNNER_KEYBINDINGS.next },
  { label: "一括 OK", keys: RUNNER_KEYBINDINGS.ok },
  { label: "一括 NG", keys: RUNNER_KEYBINDINGS.ng },
  { label: "一括 SKIP", keys: RUNNER_KEYBINDINGS.skip },
] as const;

export function ShortcutHelp() {
  return (
    <div className="group fixed right-5 bottom-20 z-30">
      <Button
        variant="outline"
        size="icon"
        className="size-9 rounded-full text-base font-bold shadow-sm"
        aria-label="キーボードショートカット"
        aria-describedby="shortcut-help-panel"
      >
        ?
      </Button>
      <div
        id="shortcut-help-panel"
        role="tooltip"
        className="pointer-events-none absolute right-0 bottom-[calc(100%+0.5rem)] hidden min-w-52 rounded-lg border bg-popover px-4 py-3 text-popover-foreground shadow-md group-focus-within:block group-hover:block"
      >
        <p className="mb-2.5 text-sm font-semibold">キーボードショートカット</p>
        <dl className="space-y-2">
          {SHORTCUT_ROWS.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd>
                <Kbd>{formatRunnerKeys(row.keys)}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2.5 border-t pt-2.5 text-xs text-muted-foreground">メモ入力中は無効</p>
      </div>
    </div>
  );
}
