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

import { boundToolOutput } from "@/lib/chat/bound-tool-output";
import {
  createDomainToolsContext,
  DOMAIN_TOOL_DEFS,
  domainToolInputSchema,
  INVALID_DOMAIN_MESSAGE,
  RATE_LIMIT_MESSAGE,
  TOOL_TIMEOUT_MESSAGE,
  type DomainToolInput,
  type DomainToolResult,
  type DomainToolSection,
} from "@/lib/chat/domain-tools";
import { getLookupErrorMessage } from "@/lib/constants/lookup-errors";
import { CHAT_TOOL_TIMEOUT_MS } from "@domainstack/constants";

interface ToolContext {
  ip: string | null;
  userId?: string | null;
}

const toolContextSchema = z.object({
  ip: z.string().nullable(),
  // Optional so contexts serialized by in-flight runs before this field existed still parse.
  userId: z.string().nullable().optional(),
});

type DomainToolSet = {
  [Def in (typeof DOMAIN_TOOL_DEFS)[number] as Def["name"]]: Tool<
    DomainToolInput,
    DomainToolResult<Def["section"]>,
    ToolContext
  >;
};

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

async function domainLookupStep(section: DomainToolSection, domain: string, ctx: ToolContext) {
  "use step";

  const { lookupSection } = await import("@domainstack/core/lookup");
  const { RateLimitError } = await import("@domainstack/redis/enforce");
  const { toRegistrableDomain } = await import("@domainstack/utils/domain");

  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    return { error: INVALID_DOMAIN_MESSAGE };
  }

  try {
    const lookup = lookupSection(section, registrable, { identifier: ctx.userId ?? ctx.ip });
    // A hung lookup would otherwise block the whole run; the abandoned promise
    // is left to settle on its own.
    void lookup.catch(() => undefined);
    const result = await withTimeout(lookup, CHAT_TOOL_TIMEOUT_MS);
    if (!result) {
      return { error: TOOL_TIMEOUT_MESSAGE };
    }
    return result.success
      ? boundToolOutput(result.data)
      : { error: getLookupErrorMessage(result.error) };
  } catch (err) {
    // Lookups report failures as `{ success: false }`; the only expected throw
    // is the rate limit. Anything else is a cache/db failure worth retrying.
    if (err instanceof RateLimitError) {
      return { error: RATE_LIMIT_MESSAGE };
    }
    // The raw message can embed SQL and parameter values, so log it and give
    // the model/UI a fixed message.
    const { createLogger } = await import("@domainstack/logger");
    createLogger({ source: "chat/tools" }).error(
      { err, section, domain: registrable },
      "domain tool lookup failed",
    );
    throw new RetryableError(`domain tool ${section} failed`, { retryAfter: "5s" });
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
    execute: async ({ domain }, { context }) => domainLookupStep(def.section, domain, context),
  });
}

export function createDomainToolset(): DomainToolSet {
  return Object.fromEntries(
    DOMAIN_TOOL_DEFS.map((def) => [def.name, makeDomainTool(def)]),
  ) as DomainToolSet;
}

export { createDomainToolsContext };
