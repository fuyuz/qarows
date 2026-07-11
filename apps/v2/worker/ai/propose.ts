import {
  computeDefinitionDiff,
  serializeTestsYaml,
  type TestDefinition,
} from "@qarows/shared";
import type { Env } from "../env";
import {
  applyDefinitionPatch,
  hasDefinitionPatch,
  parseDefinitionPatch,
} from "./apply-patches";
import { AI_ASSISTANT_INSTRUCTIONS, TESTS_YAML_AI_GUIDE } from "./prompt";
import { AiModelError, parseAiJsonResponse, runAiModel } from "./run-model";

export { AiModelError } from "./run-model";

export const MAX_AI_MESSAGE_BYTES = 4096;
export const MAX_AI_CONTEXT_YAML_CHARS = 48_000;
export const MAX_AI_HISTORY_ENTRIES = 20;

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiProposeRequest {
  message: string;
  history?: unknown;
  workingFrom?: "definition" | "proposal";
  proposalYaml?: string;
}

/** Runtime-validate client chat history (TypeScript types are not a security boundary). */
export function parseAiChatHistory(raw: unknown): AiChatMessage[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new AiModelError("history must be an array");
  }
  if (raw.length > MAX_AI_HISTORY_ENTRIES) {
    throw new AiModelError(`history must have at most ${MAX_AI_HISTORY_ENTRIES} entries`);
  }

  const history: AiChatMessage[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new AiModelError(`history[${i}] is invalid`);
    }
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") {
      throw new AiModelError(`history[${i}].role must be "user" or "assistant"`);
    }
    if (typeof content !== "string") {
      throw new AiModelError(`history[${i}].content must be a string`);
    }
    if (new TextEncoder().encode(content).byteLength > MAX_AI_MESSAGE_BYTES) {
      throw new AiModelError(`history[${i}].content is too long`);
    }
    history.push({ role, content });
  }
  return history;
}

export interface AiProposalResult {
  proposedYaml: string;
  proposedDefinition: TestDefinition;
  diff: ReturnType<typeof computeDefinitionDiff>;
  modelUsed: string;
  generatedAt: string;
}

export type AiIntent = "answer" | "clarify" | "edit";

const CATEGORY_SCHEMA = {
  type: "object" as const,
  properties: {
    major: { type: "string" },
    medium: { type: "string" },
    minor: { type: "string" },
  },
  required: ["major"],
};

const TEST_CASE_ADD_SCHEMA = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    description: { type: "string" },
    prerequisites: { type: "string" },
    category: CATEGORY_SCHEMA,
  },
  required: ["id", "description", "category"],
};

const TEST_CASE_MODIFY_SCHEMA = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    description: { type: "string" },
    prerequisites: { type: "string" },
    category: {
      type: "object" as const,
      properties: {
        major: { type: "string" },
        medium: { type: "string" },
        minor: { type: "string" },
      },
    },
  },
  required: ["id"],
};

const ENVIRONMENT_SCHEMA = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
  },
  required: ["id", "name"],
};

const ENVIRONMENT_MODIFY_SCHEMA = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
  },
  required: ["id"],
};

const PATCH_SCHEMA = {
  type: "object" as const,
  properties: {
    testCases: {
      type: "object" as const,
      properties: {
        added: { type: "array", items: TEST_CASE_ADD_SCHEMA },
        removed: { type: "array", items: { type: "string" } },
        modified: { type: "array", items: TEST_CASE_MODIFY_SCHEMA },
      },
    },
    environments: {
      type: "object" as const,
      properties: {
        added: { type: "array", items: ENVIRONMENT_SCHEMA },
        removed: { type: "array", items: { type: "string" } },
        modified: { type: "array", items: ENVIRONMENT_MODIFY_SCHEMA },
      },
    },
    project: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
      },
    },
  },
};

const AI_QUESTION_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    reply: { type: "string" },
  },
  required: ["reply"],
};

const AI_EDIT_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    reply: { type: "string" },
    patch: PATCH_SCHEMA,
  },
  required: ["reply"],
};

function isQuestionMessage(message: string): boolean {
  return /[?？]|教えて|確認|どう(して|すれば|やれば)?|何件|いくつ|一覧|説明して|説明を|わかり|分かり|教えてください|ですか|ますか/.test(
    message,
  );
}

function isEditMessage(message: string): boolean {
  return /(追加|削除|修正|変更|書き直|更新|直して|入れて|消して|編集)/.test(message);
}

function classifyMessageIntent(message: string): AiIntent {
  if (isEditMessage(message)) return "edit";
  if (isQuestionMessage(message)) return "answer";
  return "clarify";
}

function truncateYamlForPrompt(yaml: string): string {
  if (yaml.length <= MAX_AI_CONTEXT_YAML_CHARS) return yaml;
  const head = yaml.slice(0, Math.floor(MAX_AI_CONTEXT_YAML_CHARS * 0.7));
  const tail = yaml.slice(-Math.floor(MAX_AI_CONTEXT_YAML_CHARS * 0.25));
  return `${head}\n# ... truncated for AI context ...\n${tail}`;
}

function buildMessages(
  baseYaml: string,
  history: AiChatMessage[],
  message: string,
  editMode: boolean,
): { role: "system" | "user" | "assistant"; content: string }[] {
  const editHint = editMode
    ? "\n\nIMPORTANT: This is an edit request. Return a patch object only. Never output full tests.yml."
    : "";

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `${AI_ASSISTANT_INSTRUCTIONS}${editHint}\n\n${TESTS_YAML_AI_GUIDE}`,
    },
    {
      role: "user",
      content: `Current tests.yml:\n\`\`\`yaml\n${truncateYamlForPrompt(baseYaml)}\n\`\`\``,
    },
  ];

  for (const entry of history) {
    messages.push({ role: entry.role, content: entry.content });
  }
  messages.push({ role: "user", content: message });
  return messages;
}

function editFailureReply(reply: string, detail: string): {
  reply: string;
  intent: AiIntent;
  proposal: null;
} {
  return {
    reply: `${reply}\n\n（${detail}）`,
    intent: "edit",
    proposal: null,
  };
}

export async function proposeTestsYamlEdit(
  env: Env,
  input: {
    projectId: string;
    baseDefinition: TestDefinition;
    baseYaml: string;
    request: AiProposeRequest;
  },
): Promise<{
  reply: string;
  intent: AiIntent;
  proposal: AiProposalResult | null;
}> {
  const message = input.request.message.trim();
  if (!message) {
    throw new AiModelError("message is required");
  }
  if (new TextEncoder().encode(message).byteLength > MAX_AI_MESSAGE_BYTES) {
    throw new AiModelError("message is too long");
  }

  const history = parseAiChatHistory(input.request.history);
  const workingYaml =
    input.request.workingFrom === "proposal" && input.request.proposalYaml?.trim()
      ? input.request.proposalYaml
      : input.baseYaml;

  const messageIntent = classifyMessageIntent(message);
  const editMode = messageIntent === "edit";

  if (editMode && workingYaml.length > MAX_AI_CONTEXT_YAML_CHARS) {
    throw new AiModelError(
      "tests.yml が大きすぎるため AI 編集できません。質問のみ利用できます。",
    );
  }

  const { result, modelUsed } = await runAiModel(env, {
    messages: buildMessages(workingYaml, history, message, editMode),
    temperature: 0.2,
    maxTokens: editMode ? 4096 : 2048,
    jsonSchema: editMode ? AI_EDIT_JSON_SCHEMA : AI_QUESTION_JSON_SCHEMA,
  });

  const parsed = parseAiJsonResponse(result);
  const reply = parsed.reply?.trim();
  if (!reply) {
    throw new AiModelError("AI reply is empty");
  }

  if (messageIntent === "answer") {
    return { reply, intent: "answer", proposal: null };
  }

  if (messageIntent === "clarify") {
    const patch = parseDefinitionPatch(parsed);
    if (!hasDefinitionPatch(patch)) {
      return { reply, intent: "clarify", proposal: null };
    }
  }

  const patch = parseDefinitionPatch(parsed);
  if (!hasDefinitionPatch(patch)) {
    return editFailureReply(
      reply,
      "編集 patch が空です。追加・削除・変更内容を patch 形式で返してください。",
    );
  }

  try {
    const proposedDefinition = applyDefinitionPatch(input.baseDefinition, patch);
    const diff = computeDefinitionDiff(input.baseDefinition, proposedDefinition);
    if (!diff.hasChanges) {
      return editFailureReply(reply, "変更がありませんでした。patch の内容を確認してください。");
    }
    return {
      reply,
      intent: "edit",
      proposal: {
        proposedYaml: serializeTestsYaml(proposedDefinition),
        proposedDefinition,
        diff,
        modelUsed,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return editFailureReply(
      reply,
      `編集案の適用に失敗しました: ${err instanceof Error ? err.message : "Invalid patch"}`,
    );
  }
}
