import { getProjectIdFromDefinition, parseTestsYaml, serializeTestsYaml } from "@qarows/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { parseAiChatHistory, proposeTestsYamlEdit } from "../ai/propose";
import { AiRateLimitError, assertAiProposeAllowed } from "../ai/rate-limit";
import { AiModelError } from "../ai/run-model";
import {
  AiProposalError,
  getProject,
  insertAiProposal,
  listDefinitionRevisions,
  requireUsableAiProposal,
} from "../db";
import { restoreDefinitionRevision } from "../replace-definition";
import { BodyTooLargeError, MAX_AI_PROPOSE_BODY_BYTES, readRequestTextWithLimit } from "../request-body";
import { apiError, requestT } from "../i18n";
import type { AppEnv } from "../types";

interface ProposeBody {
  message?: string;
  history?: unknown;
  workingFrom?: "definition" | "proposal";
  /** @deprecated Prefer baseProposalId — full YAML bloats the request body. */
  proposalYaml?: string;
  /** Server-stored proposal to continue editing from (avoids resending YAML). */
  baseProposalId?: string;
  baseYaml?: string;
}

interface RestoreBody {
  expectedGeneration?: string;
}

function requireAi(c: Context<AppEnv>): void {
  if (!c.env.AI) {
    apiError(c, 503, "api.aiNotEnabled");
  }
}

function isAiModelError(err: unknown): err is AiModelError {
  return err instanceof AiModelError || (err instanceof Error && err.name === "AiModelError");
}

function handleAiRouteError(c: Context<AppEnv>, err: unknown): never {
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
  apiError(c, 502, "api.aiRequestFailed");
}

export function createAiRoutes(): Hono<AppEnv> {
  const ai = new Hono<AppEnv>();

  ai.use("*", async (c, next) => {
    requireAi(c);
    await next();
  });

  ai.post("/:projectId/ai/propose", async (c) => {
    try {
      await assertAiProposeAllowed(c.env.AI_RATE_LIMIT, c.get("user").email);

      const projectId = c.req.param("projectId");
      const snapshot = await getProject(c.env.DB, projectId);
      if (!snapshot) apiError(c, 404, "api.projectNotFound");

      let body: ProposeBody;
      try {
        const raw = await readRequestTextWithLimit(c.req.raw, MAX_AI_PROPOSE_BODY_BYTES);
        body = JSON.parse(raw) as ProposeBody;
      } catch (err) {
        if (err instanceof BodyTooLargeError) {
          apiError(c, 413, "api.requestBodyTooLarge");
        }
        apiError(c, 400, "api.invalidJsonBody");
      }

      const message = body.message?.trim();
      if (!message) {
        apiError(c, 400, "api.messageRequired");
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
            message: err instanceof Error ? err.message : requestT(c, "api.invalidBaseYaml"),
          });
        }
        if (getProjectIdFromDefinition(baseDefinition) !== projectId) {
          apiError(c, 400, "api.baseYamlProjectIdMismatch");
        }
      }

      let proposalYaml = body.proposalYaml?.trim() || undefined;
      const baseProposalId = body.baseProposalId?.trim();
      if (body.workingFrom === "proposal" && baseProposalId) {
        const stored = await requireUsableAiProposal(c.env.DB, {
          projectId,
          proposalId: baseProposalId,
        });
        proposalYaml = stored.proposedYaml;
      }

      if (body.workingFrom === "proposal" && proposalYaml) {
        try {
          const proposalDefinition = parseTestsYaml(proposalYaml);
          if (getProjectIdFromDefinition(proposalDefinition) !== projectId) {
            apiError(c, 400, "api.proposalYamlProjectIdMismatch");
          }
        } catch (err) {
          if (err instanceof HTTPException) throw err;
          throw new HTTPException(400, {
            message: err instanceof Error ? err.message : requestT(c, "api.invalidProposalYaml"),
          });
        }
      } else if (body.workingFrom === "proposal") {
        apiError(c, 400, "api.workingFromProposalRequiresId");
      }

      const result = await proposeTestsYamlEdit(c.env, {
        projectId,
        baseDefinition,
        baseYaml,
        t: c.get("t"),
        request: {
          message,
          history,
          workingFrom: body.workingFrom,
          proposalYaml,
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
      handleAiRouteError(c, err);
    }
  });

  ai.get("/:projectId/definition-revisions", async (c) => {
    const projectId = c.req.param("projectId");
    const snapshot = await getProject(c.env.DB, projectId);
    if (!snapshot) apiError(c, 404, "api.projectNotFound");

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
        apiError(c, 413, "api.requestBodyTooLarge");
      }
      apiError(c, 400, "api.invalidJsonBody");
    }

    const expectedGeneration = body.expectedGeneration?.trim();
    if (!expectedGeneration) {
      apiError(c, 400, "api.expectedGenerationRequired");
    }

    const result = await restoreDefinitionRevision(
      c.env,
      {
        projectId,
        revisionId,
        expectedGeneration,
        createdBy: c.get("user").email,
      },
      c.get("locale"),
    );

    return c.json({ ok: true, ...result });
  });

  return ai;
}
