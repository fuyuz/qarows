export function LoadingScreen({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
