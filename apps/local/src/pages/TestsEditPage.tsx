import { useCallback } from "react";
import type { TestDefinition } from "@qarows/shared";
import { TestsEditPageLayout } from "@qarows/runner-ui";
import { AppNav } from "@/components/AppNav";
import { useApp } from "@/context/AppContext";

export function TestsEditPage() {
  const { definition, replaceDefinition } = useApp();

  const onApply = useCallback(
    async (next: TestDefinition) => {
      await replaceDefinition(next);
    },
    [replaceDefinition],
  );

  if (!definition) return null;

  return (
    <TestsEditPageLayout
      definition={definition}
      onApply={onApply}
      navSlot={<AppNav />}
    />
  );
}
