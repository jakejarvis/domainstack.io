/**
 * Domain lookup tools for the chat workflow.
 *
 * Each tool runs the shared `domainLookupStep`. The Workflow SDK retries
 * failed steps by default. Node.js modules are imported inside the step
 * to keep them out of the workflow sandbox.
 */

import { tool, type Tool } from "ai";
import { z } from "zod";

import {
  createDomainToolsContext,
  DOMAIN_TOOL_DEFS,
  domainToolInputSchema,
  getDomainToolErrorMessage,
  getTrpcErrorCode,
  type DomainToolInput,
  type DomainToolProcedure,
  type DomainToolResult,
} from "@/lib/chat/domain-tools";

export interface ToolContext {
  ip: string | null;
}

const toolContextSchema = z.object({
  ip: z.string().nullable(),
});

type DomainToolSet = {
  [Def in (typeof DOMAIN_TOOL_DEFS)[number] as Def["name"]]: Tool<
    DomainToolInput,
    DomainToolResult<Def["procedure"]>,
    ToolContext
  >;
};

async function domainLookupStep(procedure: DomainToolProcedure, domain: string, ctx: ToolContext) {
  "use step";
  try {
    const { createCaller } = await import("@/server/routers/_app");
    const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
    const result = await trpc.domain[procedure]({ domain });
    if (!result.success) {
      return { error: result.error };
    }
    return result.data;
  } catch (err) {
    const { createLogger } = await import("@domainstack/logger");
    const logger = createLogger({ source: "chat/tools" });
    // Domain lookups return `{ success: false }` instead of throwing.
    // Throws here are tRPC validation/rate-limit errors, or unexpected bugs.
    const trpcCode = getTrpcErrorCode(err);
    if (trpcCode && trpcCode !== "INTERNAL_SERVER_ERROR") {
      logger.warn({ err, domain, procedure, code: trpcCode }, "tool step failed (expected)");
    } else {
      logger.error({ err, domain, procedure }, "tool step failed (unexpected)");
    }
    return { error: getDomainToolErrorMessage(err) };
  }
}

/**
 * Creates domain intelligence tools bound to a tool context.
 * Each tool executes as a durable workflow step with automatic retries.
 */
function makeDomainTool(def: (typeof DOMAIN_TOOL_DEFS)[number]) {
  return tool({
    description: def.description,
    inputSchema: domainToolInputSchema,
    contextSchema: toolContextSchema,
    strict: true,
    execute: async ({ domain }, { context }) => domainLookupStep(def.procedure, domain, context),
  });
}

export function createDomainToolset(): DomainToolSet {
  return Object.fromEntries(
    DOMAIN_TOOL_DEFS.map((def) => [def.name, makeDomainTool(def)]),
  ) as DomainToolSet;
}

export { createDomainToolsContext };
