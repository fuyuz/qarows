import { getProjectIdFromDefinition, parseTestsYaml, serializeTestsYaml } from "@qarows/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { parseAiChatHistory, proposeTestsYamlEdit } from "../ai/propose";
import { AiRateLimitError, assertAiProposeRateLimit } from "../ai/rate-limit";
import { AiModelError } from "../ai/run-model";
import {
  AiProposalError,
  getProject,
  insertAiProposal,
  listDefinitionRevisions,
  markAiProposalConsumed,
  requireUsableAiProposal,
} from "../db";
import {
  restoreDefinitionRevision,
  saveCheckpointAndReplaceDefinition,
} from "../replace-definition";
import { BodyTooLargeError, MAX_TESTS_YAML_BYTES, readRequestTextWithLimit } from "../request-body";
import type { AppEnv } from "../types";

interface ProposeBody {
  message?: string;
  history?: unknown;
  workingFrom?: "definition" | "proposal";
  proposalYaml?: string;
  baseYaml?: string;
}

interface ApplyBody {
  proposalId?: string;
  expectedGeneration?: string;
  instruction?: string;
  /** @deprecated Client YAML is ignored — proposals are server-stored. */
  proposedYaml?: string;
}

interface RestoreBody {
  expectedGeneration?: string;
}

function requireAi(c: { env: AppEnv["Bindings"] }): void {
  if (!c.env.AI) {
    throw new HTTPException(503, { message: "AI is not enabled on this deployment" });
  }
}

function isAiModelError(err: unknown): err is AiModelError {
  return err instanceof AiModelError || (err instanceof Error && err.name === "AiModelError");
}

function handleAiRouteError(err: unknown): never {
  if (err instanceof HTTPException) throw err;
  if (err instanceof AiProposalError) {
    throw new HTTPException(err.status, { message: err.message });
  }
  if (err instanceof AiRateLimitError) {
    throw new HTTPException(429, { message: err.message });
  }
  if (isAiModelError(err)) {
    throw new HTTPException(502, { message: err.message });
  }
  console.error("AI route error", err);
  const message = err instanceof Error ? err.message : "AI request failed";
  throw new HTTPException(502, { message });
}

export function createAiRoutes(): Hono<AppEnv> {
  const ai = new Hono<AppEnv>();

  ai.use("*", async (c, next) => {
    requireAi(c);
    await next();
  });

  ai.post("/:projectId/ai/propose", async (c) => {
    try {
      assertAiProposeRateLimit(c.get("user").email);

      const projectId = c.req.param("projectId");
      const snapshot = await getProject(c.env.DB, projectId);
      if (!snapshot) throw new HTTPException(404, { message: "Project not found" });

      let body: ProposeBody;
      try {
        const raw = await readRequestTextWithLimit(c.req.raw, 32_768);
        body = JSON.parse(raw) as ProposeBody;
      } catch (err) {
        if (err instanceof BodyTooLargeError) {
          throw new HTTPException(413, { message: "Request body is too large" });
        }
        throw new HTTPException(400, { message: "Invalid JSON body" });
      }

      const message = body.message?.trim();
      if (!message) {
        throw new HTTPException(400, { message: "message is required" });
      }

      let history;
      try {
        history = parseAiChatHistory(body.history);
      } catch (err) {
        if (isAiModelError(err)) {
          throw new HTTPException(400, { message: err.message });
        }
        throw err;
      }

      let baseDefinition = snapshot.definition;
      let baseYaml = serializeTestsYaml(snapshot.definition);
      const overrideYaml = body.baseYaml?.trim();
      if (overrideYaml) {
        try {
          baseDefinition = parseTestsYaml(overrideYaml);
          baseYaml = serializeTestsYaml(baseDefinition);
        } catch (err) {
          throw new HTTPException(400, {
            message: err instanceof Error ? err.message : "Invalid baseYaml",
          });
        }
        if (getProjectIdFromDefinition(baseDefinition) !== projectId) {
          throw new HTTPException(400, {
            message: "baseYaml project.id が URL の projectId と一致しません",
          });
        }
      }

      const result = await proposeTestsYamlEdit(c.env, {
        projectId,
        baseDefinition,
        baseYaml,
        request: {
          message,
          history,
          workingFrom: body.workingFrom,
          proposalYaml: body.proposalYaml,
        },
      });

      if (!result.proposal) {
        return c.json(result);
      }

      const stored = await insertAiProposal(c.env.DB, {
        projectId,
        proposedYaml: result.proposal.proposedYaml,
        baseGeneration: snapshot.generation,
        instruction: message,
        createdBy: c.get("user").email,
      });

      return c.json({
        reply: result.reply,
        intent: result.intent,
        proposal: {
          ...result.proposal,
          proposalId: stored.id,
          expiresAt: stored.expiresAt,
        },
      });
    } catch (err) {
      handleAiRouteError(err);
    }
  });

  ai.post("/:projectId/ai/apply", async (c) => {
    try {
      const projectId = c.req.param("projectId");
      let body: ApplyBody;
      try {
        const raw = await readRequestTextWithLimit(c.req.raw, 4096);
        body = JSON.parse(raw) as ApplyBody;
      } catch (err) {
        if (err instanceof BodyTooLargeError) {
          throw new HTTPException(413, { message: "Request body is too large" });
        }
        throw new HTTPException(400, { message: "Invalid JSON body" });
      }

      if (body.proposedYaml != null) {
        throw new HTTPException(400, {
          message: "proposedYaml is no longer accepted; pass proposalId from /ai/propose",
        });
      }

      const proposalId = body.proposalId?.trim();
      const expectedGeneration = body.expectedGeneration?.trim();
      if (!proposalId) {
        throw new HTTPException(400, { message: "proposalId is required" });
      }
      if (!expectedGeneration) {
        throw new HTTPException(400, { message: "expectedGeneration is required" });
      }

      const proposal = await requireUsableAiProposal(c.env.DB, { projectId, proposalId });

      const result = await saveCheckpointAndReplaceDefinition(c.env, {
        projectId,
        testsYaml: proposal.proposedYaml,
        expectedGeneration,
        source: "ai_apply",
        instruction: body.instruction?.trim() || proposal.instruction,
        createdBy: c.get("user").email,
      });

      await markAiProposalConsumed(c.env.DB, { projectId, proposalId });

      return c.json({ ok: true, ...result });
    } catch (err) {
      handleAiRouteError(err);
    }
  });

  ai.get("/:projectId/definition-revisions", async (c) => {
    const projectId = c.req.param("projectId");
    const snapshot = await getProject(c.env.DB, projectId);
    if (!snapshot) throw new HTTPException(404, { message: "Project not found" });

    const revisions = await listDefinitionRevisions(c.env.DB, projectId);
    return c.json({ revisions });
  });

  ai.post("/:projectId/definition-revisions/:revisionId/restore", async (c) => {
    const projectId = c.req.param("projectId");
    const revisionId = c.req.param("revisionId");

    let body: RestoreBody;
    try {
      const raw = await readRequestTextWithLimit(c.req.raw, 4096);
      body = raw.trim() ? (JSON.parse(raw) as RestoreBody) : {};
    } catch (err) {
      if (err instanceof BodyTooLargeError) {
        throw new HTTPException(413, { message: "Request body is too large" });
      }
      throw new HTTPException(400, { message: "Invalid JSON body" });
    }

    const expectedGeneration = body.expectedGeneration?.trim();
    if (!expectedGeneration) {
      throw new HTTPException(400, { message: "expectedGeneration is required" });
    }

    const result = await restoreDefinitionRevision(c.env, {
      projectId,
      revisionId,
      expectedGeneration,
      createdBy: c.get("user").email,
    });

    return c.json({ ok: true, ...result });
  });

  return ai;
}
