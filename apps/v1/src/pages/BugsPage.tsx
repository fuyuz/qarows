import { AppNav } from "@/components/AppNav";
import { BugProgressBar } from "@/components/BugProgressBar";
import { BugTaskList } from "@/components/BugTaskList";
import { BugViewer } from "@/components/BugViewer";
import { FilterBar } from "@/components/FilterBar";
import { useApp } from "@/context/AppContext";

export function BugsPage() {
  const { definition, results } = useApp();

  if (!definition || !results) return null;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <AppNav />
      <FilterBar variant="bugs" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-24 pt-4">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 md:flex-row md:items-stretch">
          <BugTaskList />
          <BugViewer />
        </div>
      </main>
      <BugProgressBar />
    </div>
  );
}
