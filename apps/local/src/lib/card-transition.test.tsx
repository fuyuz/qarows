import { render, act } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { RunnerCardTransition } from "@qarows/runner-ui";

beforeAll(() => {
  // jsdom には matchMedia が無い。crossfade を有効な側で検証したい
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

/** カード内の一時的な UI 状態（クリア成功メッセージ等）を持つ子 */
function Card() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button type="button" onClick={() => setMessage("cleared")}>
        act
      </button>
      {message && <p data-testid="message">{message}</p>}
    </div>
  );
}

function Harness({ slideKey }: { slideKey: string }) {
  return (
    <RunnerCardTransition slideKey={slideKey}>
      <Card />
    </RunnerCardTransition>
  );
}

function enteringCard(container: HTMLElement): HTMLElement {
  return (container.querySelector(".runner-card-crossfade__enter") ?? container) as HTMLElement;
}

describe("RunnerCardTransition", () => {
  it("keeps the card's own state when the crossfade finishes", () => {
    vi.useFakeTimers();
    try {
      const { container, rerender, unmount } = render(<Harness slideKey="a" />);
      act(() => {
        rerender(<Harness slideKey="b" />);
      });

      // crossfade 中は退出中のカードも残るので、入場側だけを操作する
      act(() => {
        enteringCard(container).querySelector("button")!.click();
      });
      expect(container.querySelectorAll('[data-testid="message"]')).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // crossfade 終了で木の形が変わり子が unmount されると、ここで消えていた
      expect(container.querySelectorAll('[data-testid="message"]')).toHaveLength(1);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("still resets state when the card itself changes", () => {
    vi.useFakeTimers();
    try {
      const { container, rerender, unmount } = render(<Harness slideKey="a" />);
      act(() => {
        container.querySelector("button")!.click();
      });
      expect(container.querySelectorAll('[data-testid="message"]')).toHaveLength(1);

      // 別プロジェクトのカードに切り替えたら前のカードの状態は引き継がない
      act(() => {
        rerender(<Harness slideKey="b" />);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(container.querySelectorAll('[data-testid="message"]')).toHaveLength(0);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
