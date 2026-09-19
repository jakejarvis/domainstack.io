/**
 * Domain lookup tools for the chat workflow.
 *
 * Each tool runs the shared `domainLookupStep`. The Workflow SDK retries
 * failed steps by default. Node.js modules are imported inside the step
 * to keep them out of the workflow sandbox.
 */

import { tool, type Tool } from "ai";
import { RetryableError } from "workflow";
import { z } from "zod";

import {
  createDomainToolsContext,
  DOMAIN_TOOL_DEFS,
  domainToolInputSchema,
  getDomainToolErrorMessage,
  type DomainToolInput,
  type DomainToolProcedure,
  type DomainToolResult,
} from "@/lib/chat/domain-tools";
import { isExpectedTrpcError } from "@/lib/trpc/errors";
import { CHAT_TOOL_TIMEOUT_MS } from "@domainstack/constants";

interface ToolContext {
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

const TOOL_TIMEOUT_MESSAGE = "The lookup timed out. Try again in a moment.";

/** Resolves to `null` if `promise` has not settled within `ms`. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function domainLookupStep(procedure: DomainToolProcedure, domain: string, ctx: ToolContext) {
  "use step";
  try {
    const { createCaller } = await import("@domainstack/api");
    const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
    const lookup = (async () => trpc.domain[procedure]({ domain }))();
    // A hung lookup would otherwise block the whole run; the abandoned promise
    // is left to settle on its own.
    void lookup.catch(() => undefined);
    const result = await withTimeout(lookup, CHAT_TOOL_TIMEOUT_MS);
    if (!result) {
      return { error: TOOL_TIMEOUT_MESSAGE };
    }
    if (!result.success) {
      return { error: result.error };
    }
    return result.data;
  } catch (err) {
    // Domain lookups return `{ success: false }` instead of throwing.
    // Throws here are tRPC validation/rate-limit errors, or unexpected bugs.
    if (isExpectedTrpcError(err)) {
      return { error: getDomainToolErrorMessage(err) };
    }
    const reason = err instanceof Error ? err.message : String(err);
    throw new RetryableError(`domain tool ${procedure} failed: ${reason}`, { retryAfter: "5s" });
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
