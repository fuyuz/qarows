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
import { useApp } from "@/context/AppContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";
import { downloadBlob, downloadText } from "@/lib/utils";

export function AppNav() {
  const { definition, results, session } = useApp();
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
