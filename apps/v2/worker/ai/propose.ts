import {
  computeDefinitionDiff,
  getProjectIdFromDefinition,
  parseTestsYaml,
  type TestDefinition,
} from "@qarows/shared";
import type { Env } from "../env";
import { AI_ASSISTANT_INSTRUCTIONS, TESTS_YAML_AI_GUIDE } from "./prompt";
import { AiModelError, extractAiResponseText, runAiModel } from "./run-model";

export { AiModelError } from "./run-model";

export const MAX_AI_MESSAGE_BYTES = 4096;
export const MAX_AI_CONTEXT_YAML_CHARS = 48_000;

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiProposeRequest {
  message: string;
  history?: AiChatMessage[];
  workingFrom?: "definition" | "proposal";
  proposalYaml?: string;
}

export interface AiProposalResult {
  proposedYaml: string;
  proposedDefinition: TestDefinition;
  diff: ReturnType<typeof computeDefinitionDiff>;
  modelUsed: string;
  generatedAt: string;
}

export type AiIntent = "answer" | "clarify" | "edit";

interface AiJsonResponse {
  reply?: string;
  testsYaml?: string | null;
}

const AI_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    reply: { type: "string" },
    testsYaml: { type: "string" },
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
): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `${AI_ASSISTANT_INSTRUCTIONS}\n\n${TESTS_YAML_AI_GUIDE}`,
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

function parseAiJson(raw: string): AiJsonResponse {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate) as AiJsonResponse;
  } catch {
    throw new AiModelError("AI response was not valid JSON");
  }
}

function inferIntent(testsYaml: string | null | undefined): AiIntent {
  if (testsYaml == null || testsYaml.trim() === "") {
    return "answer";
  }
  return "edit";
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

  const history = input.request.history ?? [];
  const workingYaml =
    input.request.workingFrom === "proposal" && input.request.proposalYaml?.trim()
      ? input.request.proposalYaml
      : input.baseYaml;

  const { result, modelUsed } = await runAiModel(env, {
    messages: buildMessages(workingYaml, history, message),
    temperature: 0.2,
    maxTokens: 4096,
    jsonSchema: AI_JSON_SCHEMA,
  });

  const parsed = parseAiJson(extractAiResponseText(result));
  const reply = parsed.reply?.trim();
  if (!reply) {
    throw new AiModelError("AI reply is empty");
  }

  const testsYamlRaw = parsed.testsYaml;
  const testsYaml =
    testsYamlRaw == null || String(testsYamlRaw).trim() === ""
      ? null
      : String(testsYamlRaw).trim();

  const messageIntent = classifyMessageIntent(message);
  if (messageIntent === "answer") {
    return { reply, intent: "answer", proposal: null };
  }

  let intent = inferIntent(testsYaml);
  if (messageIntent === "clarify" && intent === "answer") {
    intent = "clarify";
  } else if (messageIntent === "edit") {
    intent = "edit";
  }

  if (!testsYaml) {
    return { reply, intent, proposal: null };
  }

  let proposedDefinition: TestDefinition;
  try {
    proposedDefinition = parseTestsYaml(testsYaml);
  } catch (err) {
    return {
      reply: `${reply}\n\n（tests.yml の検証に失敗しました: ${err instanceof Error ? err.message : "Invalid YAML"}）`,
      intent: "edit",
      proposal: null,
    };
  }

  const yamlProjectId = getProjectIdFromDefinition(proposedDefinition);
  if (yamlProjectId !== input.projectId) {
    return {
      reply: `${reply}\n\n（project.id を ${input.projectId} から変更できません）`,
      intent: "edit",
      proposal: null,
    };
  }

  const diff = computeDefinitionDiff(input.baseDefinition, proposedDefinition);
  const generatedAt = new Date().toISOString();

  return {
    reply,
    intent: "edit",
    proposal: {
      proposedYaml: testsYaml,
      proposedDefinition,
      diff,
      modelUsed,
      generatedAt,
    },
  };
}
