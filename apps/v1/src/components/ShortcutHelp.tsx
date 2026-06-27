import { formatRunnerKeys, RUNNER_KEYBINDINGS } from "@/lib/runner-keybindings";
import { Kbd } from "@/components/qa-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SHORTCUT_ROWS = [
  { label: "前のテスト", keys: RUNNER_KEYBINDINGS.prev },
  { label: "次のテスト", keys: RUNNER_KEYBINDINGS.next },
  { label: "一括 OK", keys: RUNNER_KEYBINDINGS.ok },
  { label: "一括 NG", keys: RUNNER_KEYBINDINGS.ng },
  { label: "一括 SKIP", keys: RUNNER_KEYBINDINGS.skip },
] as const;

export function ShortcutHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed right-5 bottom-20 z-30 size-9 rounded-full text-base font-bold shadow-sm"
          aria-label="キーボードショートカット"
        >
          ?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>キーボードショートカット</DialogTitle>
          <DialogDescription className="sr-only">テスト実行画面で使えるショートカット一覧</DialogDescription>
        </DialogHeader>
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
        <p className="border-t pt-3 text-xs text-muted-foreground">メモ入力中は無効</p>
      </DialogContent>
    </Dialog>
  );
}
