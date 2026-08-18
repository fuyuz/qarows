import { useMemo, type ReactNode } from "react";
import {
  RunnerWorkspaceProvider,
  type BugAttachmentsAdapter,
  type RunnerWorkspaceValue,
} from "@qarows/runner-ui";
import { useAiFeatures } from "@/context/AiFeaturesContext";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { attachmentUrl, deleteAttachment, uploadAttachment } from "@/lib/api/attachments";

export function RunnerWorkspaceBridge({ children }: { children: ReactNode }) {
  const sync = useProjectSync();
  const { attachmentsEnabled } = useAiFeatures();
  const projectId = sync.projectId;

  // R2 バケット未設定のデプロイでは undefined のままにして添付 UI を出さない
  const attachments = useMemo<BugAttachmentsAdapter | undefined>(() => {
    if (!attachmentsEnabled) return undefined;
    return {
      upload: (file: File) => uploadAttachment(projectId, file),
      remove: (key: string) => deleteAttachment(projectId, key),
      url: (key: string) => attachmentUrl(projectId, key),
    };
  }, [attachmentsEnabled, projectId]);

  const value = useMemo<RunnerWorkspaceValue>(
    () => ({
      definition: sync.definition,
      results: sync.results,
      session: sync.session,
      lastUpdatedTestId: sync.lastUpdatedTestId,
      updateResults: sync.updateResults,
      updateResultsBatch: sync.updateResultsBatch,
      updateTestMemo: sync.updateTestMemo,
      addBug: sync.addBug,
      updateBug: sync.updateBug,
      updateTestCase: sync.updateTestCase,
      clearTestResult: sync.clearTestResult,
      attachments,
    }),
    [
      attachments,
      sync.definition,
      sync.results,
      sync.session,
      sync.lastUpdatedTestId,
      sync.updateResults,
      sync.updateResultsBatch,
      sync.updateTestMemo,
      sync.addBug,
      sync.updateBug,
      sync.updateTestCase,
      sync.clearTestResult,
    ],
  );

  return <RunnerWorkspaceProvider value={value}>{children}</RunnerWorkspaceProvider>;
}
