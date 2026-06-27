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
  slideKey: number;
  children: ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const storedRef = useRef({ key: slideKey, node: children });
  const [exiting, setExiting] = useState<{ key: number; node: ReactNode } | null>(null);

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

  if (reducedMotion || !exiting) {
    return <div className="relative">{children}</div>;
  }

  return (
    <div className="runner-card-crossfade relative grid [&>*]:col-start-1 [&>*]:row-start-1">
      <div
        className="runner-card-crossfade__exit pointer-events-none"
        key={`exit-${exiting.key}`}
      >
        {exiting.node}
      </div>
      <div className="runner-card-crossfade__enter" key={`enter-${slideKey}`}>
        {children}
      </div>
    </div>
  );
}
