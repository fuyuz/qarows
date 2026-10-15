import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "@qarows/ui";
import { useRunnerWorkspace } from "../context/runner-workspace";

/** Tailwind Typography を入れていないので、要素ごとに最低限の体裁を当てる */
const markdownComponents: Components = {
  h1: ({ children }) => <h2 className="mt-8 mb-3 text-xl font-bold tracking-tight first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-7 mb-2.5 text-lg font-bold tracking-tight first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-6 mb-2 text-base font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-5 mb-2 text-sm font-semibold first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-border pl-4 text-muted-foreground">{children}</blockquote>
  ),
  code: ({ children, className }) => (
    <code className={className ?? "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"}>{children}</code>
  ),
  pre: ({ children }) => (
    // react-markdown 10 は code にインラインかどうかを渡さないので、ブロック内ではインライン用の装飾を打ち消す
    <pre className="my-3 overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm leading-relaxed [&>code]:rounded-none [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[1em]">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border bg-muted/60 px-3 py-1.5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-3 py-1.5 align-top">{children}</td>,
};

export function OverviewPageLayout({ nav }: { nav: ReactNode }) {
  const { t } = useTranslation();
  const { definition } = useRunnerWorkspace();

  if (!definition) return null;

  return (
    <div className="flex min-h-svh flex-col">
      {nav}
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
        <h1 className="mb-6 text-lg font-bold tracking-tight">{t("nav.overview")}</h1>
        {definition.overview ? (
          <article className="rounded-lg border bg-card px-6 py-5 text-sm text-foreground">
            {/* 生 HTML は react-markdown の既定どおり描画しない（tests.yml は共有されるファイルのため） */}
            <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {definition.overview}
            </Markdown>
          </article>
        ) : (
          <div className="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            <p>{t("runner.overviewEmpty")}</p>
            <p className="mt-1 text-xs">{t("runner.overviewEmptyHint")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
