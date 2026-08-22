import { useEffect, useRef, useState, type ReactNode } from "react";

const CROSSFADE_MS = 400;

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(mq.matches);
    const onChange = () => setPrefers(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return prefers;
}

export function RunnerCardTransition({
  slideKey,
  children,
}: {
  slideKey: string | number;
  children: ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const storedRef = useRef({ key: slideKey, node: children });
  const [exiting, setExiting] = useState<{ key: string | number; node: ReactNode } | null>(null);

  if (slideKey !== storedRef.current.key) {
    if (!reducedMotion) {
      setExiting(storedRef.current);
    }
    storedRef.current = { key: slideKey, node: children };
  }

  useEffect(() => {
    if (!exiting || reducedMotion) return;
    const id = window.setTimeout(() => setExiting(null), CROSSFADE_MS);
    return () => window.clearTimeout(id);
  }, [exiting, reducedMotion]);

  const crossfading = !reducedMotion && exiting != null;

  // 入場側は crossfade の開始・終了で位置とキーを変えない。
  // 以前は crossfade 終了時に木の形が変わって子が unmount され、
  // カード内の一時的な状態（成功メッセージ等）が 400ms 後に消えていた
  return (
    <div
      className={
        crossfading
          ? "runner-card-crossfade relative grid h-full min-h-0 [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:h-full [&>*]:min-h-0"
          : "relative h-full min-h-0"
      }
    >
      {crossfading ? (
        <div
          className="runner-card-crossfade__exit pointer-events-none"
          key={`exit-${exiting.key}`}
        >
          {exiting.node}
        </div>
      ) : null}
      <div
        className={crossfading ? "runner-card-crossfade__enter" : "h-full min-h-0"}
        key={`enter-${slideKey}`}
      >
        {children}
      </div>
    </div>
  );
}
