import { Fragment, type ReactNode } from "react";

/** 日本語の文中に貼られることが多いため、全角の括弧・句読点で URL を区切る */
const URL_PATTERN = /https?:\/\/[^\s<>"'「」『』（）、。]+/g;
/** 文末の句読点や閉じ括弧は URL に含めない */
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/** テキスト中の URL を別タブで開くリンクにする */
export function LinkifiedText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING_PUNCTUATION, "");
    const start = match.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(
      <a
        key={start}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {url}
      </a>,
    );
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <Fragment>{parts}</Fragment>;
}
