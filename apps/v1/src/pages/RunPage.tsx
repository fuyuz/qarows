import { FilterBar } from "@/components/FilterBar";
import { AppNav } from "@/components/AppNav";
import { RunProgressBar } from "@/components/RunProgressBar";
import { RunnerTaskList } from "@/components/RunnerTaskList";
import { ShortcutHelp } from "@/components/ShortcutHelp";
import { TestRunner } from "@/components/TestRunner";
import { useApp } from "@/context/AppContext";

export function RunPage() {
  const { definition, session } = useApp();

  if (!definition || !session) return null;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <AppNav />
      <FilterBar />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-24 pt-4">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 md:flex-row md:items-stretch">
          <RunnerTaskList />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <TestRunner />
          </div>
        </div>
      </main>
      <RunProgressBar />
      <ShortcutHelp />
    </div>
  );
}
