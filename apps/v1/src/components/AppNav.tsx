import { serializeResultsJson, serializeTestsYaml } from "@qarows/shared";
import { WorkspaceAppNav } from "@qarows/ui";
import { useApp } from "@/context/AppContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";
import { downloadText } from "@/lib/utils";

export function AppNav() {
  const { definition, results, session } = useApp();
  const { path } = useProjectRoutes();

  return (
    <WorkspaceAppNav
      definition={definition}
      session={session}
      results={results}
      path={path}
      onExportYaml={
        definition
          ? () => downloadText(serializeTestsYaml(definition), "tests.yml", "text/yaml")
          : undefined
      }
      onExportResults={
        results
          ? () => downloadText(serializeResultsJson(results), "results.json", "application/json")
          : undefined
      }
    />
  );
}
