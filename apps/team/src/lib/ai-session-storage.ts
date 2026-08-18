import type { AiChatMessage } from "@/lib/api/ai";
import type { AiProposal } from "@/lib/api/ai";

const STORAGE_PREFIX = "qarows-ai-session:";

export interface AiSessionState {
  chatMessages: AiChatMessage[];
  proposal: AiProposal | null;
  workingFrom: "definition" | "proposal";
  baseGeneration: string;
}

export function loadAiSession(projectId: string): AiSessionState | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AiSessionState;
  } catch {
    return null;
  }
}

export function saveAiSession(projectId: string, state: AiSessionState): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function clearAiSession(projectId: string): void {
  sessionStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
}
