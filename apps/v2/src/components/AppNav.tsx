import {
  createEmptyResults,
  getProjectIdFromDefinition,
  packProjectArchive,
  projectArchiveFilename,
  projectArchiveToBlob,
  serializeResultsJson,
  serializeTestsYaml,
} from "@qarows/shared";
import { WorkspaceAppNav } from "@qarows/ui";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";
import { downloadBlob, downloadText } from "@/lib/file-utils";

export function AppNav({ offsetRight }: { offsetRight?: number } = {}) {
  const { definition, results, session, connected, connectionStatus, pendingCommands, revision, syncPulseKey } =
    useProjectSync();
  const { path } = useProjectRoutes();

  const exportZip =
    definition != null
      ? () => {
          const projectId = getProjectIdFromDefinition(definition);
          const archive = packProjectArchive({
            testsYaml: serializeTestsYaml(definition),
            resultsJson: serializeResultsJson(results ?? createEmptyResults(projectId)),
          });
          downloadBlob(projectArchiveToBlob(archive), projectArchiveFilename(projectId));
        }
      : undefined;

  return (
    <WorkspaceAppNav
      definition={definition}
      session={session}
      results={results}
      path={path}
      availablePages={["session", "run", "matrix", "dashboard", "bugs", "tests"]}
      offsetRight={offsetRight}
      syncStatus={{
        connected,
        connectionStatus,
        pendingCommands,
        revision,
        syncPulseKey,
      }}
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
      onExportZip={exportZip}
    />
  );
}
