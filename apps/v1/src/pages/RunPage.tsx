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
    <div className="run-layout">
      <AppNav />
      <FilterBar />
      <main className="page run-content">
        <div className="run-workspace" style={workspaceStyle}>
          <RunnerTaskList />
          <div ref={mainRef} className="run-workspace__main">
            <TestRunner />
          </div>
        </div>
      </main>
      <RunProgressBar />
      <ShortcutHelp />
    </div>
  );
}
