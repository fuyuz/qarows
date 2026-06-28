export function LoadingScreen({ message = "読み込み中…" }: { message?: string }) {
  return (
    <main
      className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-5"
      aria-busy="true"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(0.922 0 0 / 0.65) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.922 0 0 / 0.65) 1px, transparent 1px)
          `,
          backgroundSize: "1.75rem 1.75rem",
        }}
        aria-hidden
      />

      <div className="relative flex w-full max-w-sm animate-in fade-in duration-300 flex-col items-center gap-8">
        <div className="text-center">
          <p className="text-lg font-bold tracking-tight">qarows</p>
          <p className="text-xs text-muted-foreground">QA シート特化ツール</p>
        </div>

        <div className="w-full space-y-3" role="status" aria-live="polite" aria-label={message}>
          <div
            className="relative h-2.5 overflow-hidden rounded-full bg-muted shadow-inner"
            aria-hidden
          >
            <div className="loading-screen-indicator absolute inset-y-0 w-2/5 rounded-full bg-primary" />
          </div>

          <p className="text-center text-sm font-medium text-muted-foreground">{message}</p>
        </div>
      </div>
    </main>
  );
}
