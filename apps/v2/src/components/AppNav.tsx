import { useParams } from "react-router-dom";
import { serializeResultsJson, serializeTestsYaml } from "@qarows/shared";
import { WorkspaceAppNav } from "@qarows/ui";
import { useAiFeatures } from "@/context/AiFeaturesContext";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";
import { projectPath } from "@/lib/project-routes";
import { downloadText } from "@/lib/file-utils";

export function AppNav() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { aiEnabled } = useAiFeatures();
  const { definition, results, session, connected, connectionStatus, pendingCommands, revision, syncPulseKey } =
    useProjectSync();
  const { path } = useProjectRoutes();

  const projectId = routeProjectId ?? definition?.project.id;
  const extraMenuItems =
    aiEnabled && definition && projectId
      ? [{ label: "AI 編集", to: projectPath(projectId, "ai") }]
      : undefined;

  return (
    <WorkspaceAppNav
      definition={definition}
      session={session}
      results={results}
      path={path}
      syncStatus={{
        connected,
        connectionStatus,
        pendingCommands,
        revision,
        syncPulseKey,
      }}
      extraMenuItems={extraMenuItems}
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
