import { useState } from "react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { ProjectListPanel, type ProjectListPanelProps } from "./project-list-panel";

export type ProjectListShellProps = Omit<ProjectListPanelProps, "className">;

export function ProjectListShell(panelProps: ProjectListShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const listCount = panelProps.summaries.length + 1;

  const handleSelect = (projectId: string) => {
    panelProps.onSelect(projectId);
    setMobileOpen(false);
  };

  const sharedPanelProps = { ...panelProps, onSelect: handleSelect };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mb-2 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        プロジェクト ({listCount})
      </Button>

      <ProjectListPanel
        {...sharedPanelProps}
        className="hidden h-full min-h-0 w-84 shrink-0 md:flex"
      />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100vw-1.5rem,22rem)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>プロジェクト一覧</SheetTitle>
          </SheetHeader>
          <ProjectListPanel
            {...sharedPanelProps}
            className="h-full rounded-none border-0 bg-background"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
