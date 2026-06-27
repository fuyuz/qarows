import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FilterBar } from "@/components/FilterBar";
import { AppNav } from "@/components/AppNav";
import { RunProgressBar } from "@/components/RunProgressBar";
import { RunnerTaskList } from "@/components/RunnerTaskList";
import { ShortcutHelp } from "@/components/ShortcutHelp";
import { TestRunner } from "@/components/TestRunner";
import { useApp } from "@/context/AppContext";

export function RunPage() {
  const { definition, session } = useApp();
  const mainRef = useRef<HTMLDivElement>(null);
  const [mainHeight, setMainHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = mainRef.current;
    if (!element) return;

    const updateHeight = () => {
      setMainHeight(element.getBoundingClientRect().height);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [definition, session]);

  if (!definition || !session) return null;

  const workspaceStyle =
    mainHeight != null
      ? ({ "--run-main-height": `${mainHeight}px` } as CSSProperties)
      : undefined;

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav />
      <FilterBar />
      <main className="flex-1 px-5 pb-24 pt-4">
        <div
          className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 md:flex-row"
          style={workspaceStyle}
        >
          <RunnerTaskList />
          <div ref={mainRef} className="min-h-0 min-w-0 flex-1">
            <TestRunner />
          </div>
        </div>
      </main>
      <RunProgressBar />
      <ShortcutHelp />
    </div>
  );
}
