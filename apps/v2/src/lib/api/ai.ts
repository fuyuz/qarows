import type { DefinitionDiff, TestDefinition } from "@qarows/shared";
import { apiJson } from "@/lib/api/client";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AiIntent = "answer" | "clarify" | "edit";

export interface AiProposal {
  proposalId: string;
  proposedYaml: string;
  proposedDefinition: TestDefinition;
  diff: DefinitionDiff;
  modelUsed: string;
  generatedAt: string;
  expiresAt: string;
}

export interface AiProposeResponse {
  reply: string;
  intent: AiIntent;
  proposal: AiProposal | null;
}

export interface DefinitionRevisionSummary {
  id: string;
  source: string;
  instruction: string | null;
  createdBy: string | null;
  createdAt: string;
}

export async function proposeAiEdit(
  projectId: string,
  body: {
    message: string;
    history?: AiChatMessage[];
    workingFrom?: "definition" | "proposal";
    /** Prefer baseProposalId to avoid large request bodies. */
    proposalYaml?: string;
    /** Continue from a server-stored proposal instead of resending YAML. */
    baseProposalId?: string;
    /** When set, AI edits against this YAML (e.g. current editor draft) instead of saved definition */
    baseYaml?: string;
  },
): Promise<AiProposeResponse> {
  return apiJson<AiProposeResponse>(`/api/projects/${encodeURIComponent(projectId)}/ai/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function applyAiProposal(
  projectId: string,
  body: {
    proposalId: string;
    expectedGeneration: string;
    instruction?: string;
  },
): Promise<{ ok: true; generation: string; revisionId: string }> {
  return apiJson(`/api/projects/${encodeURIComponent(projectId)}/ai/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listDefinitionRevisions(
  projectId: string,
): Promise<{ revisions: DefinitionRevisionSummary[] }> {
  return apiJson(`/api/projects/${encodeURIComponent(projectId)}/definition-revisions`);
}

export async function restoreDefinitionRevision(
  projectId: string,
  revisionId: string,
  expectedGeneration: string,
): Promise<{ ok: true; generation: string }> {
  return apiJson(
    `/api/projects/${encodeURIComponent(projectId)}/definition-revisions/${encodeURIComponent(revisionId)}/restore`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedGeneration }),
    },
  );
}
