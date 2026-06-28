import { serializeResultsJson, serializeTestsYaml } from "@qarows/shared";
import { SyncStatusBadge, WorkspaceAppNav } from "@qarows/ui";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";
import { downloadText } from "@/lib/file-utils";

export function AppNav() {
  const { definition, results, session, connected, connectionStatus, pendingCommands, revision } =
    useProjectSync();
  const { path } = useProjectRoutes();

  return (
    <WorkspaceAppNav
      definition={definition}
      session={session}
      results={results}
      path={path}
      statusSlot={
        <SyncStatusBadge
          connected={connected}
          connectionStatus={connectionStatus}
          pendingCommands={pendingCommands}
          revision={revision}
        />
      }
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
