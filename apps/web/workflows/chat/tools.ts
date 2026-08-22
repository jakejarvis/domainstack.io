/**
 * Domain lookup tools for the chat workflow.
 *
 * Each tool runs the shared `domainLookupStep`. The Workflow SDK retries
 * failed steps by default. Node.js modules are imported inside the step
 * to keep them out of the workflow sandbox.
 */

import { tool } from "ai";
import { z } from "zod";

import {
  createDomainToolsContext,
  DOMAIN_TOOL_DEFS,
  domainToolInputSchema,
  getDomainToolErrorMessage,
  type DomainToolProcedure,
} from "@/lib/chat/domain-tools";

export interface ToolContext {
  ip: string | null;
}

const toolContextSchema = z.object({
  ip: z.string().nullable(),
});

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
    logger.warn({ err, domain, procedure }, "tool step failed");
    return { error: getDomainToolErrorMessage(err, domain) };
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

export function createDomainToolset() {
  return {
    get_registration: makeDomainTool(lookupToolDef("get_registration")),
    get_dns_records: makeDomainTool(lookupToolDef("get_dns_records")),
    get_hosting: makeDomainTool(lookupToolDef("get_hosting")),
    get_certificates: makeDomainTool(lookupToolDef("get_certificates")),
    get_headers: makeDomainTool(lookupToolDef("get_headers")),
    get_seo: makeDomainTool(lookupToolDef("get_seo")),
  };
}

function lookupToolDef<N extends (typeof DOMAIN_TOOL_DEFS)[number]["name"]>(name: N) {
  const def = DOMAIN_TOOL_DEFS.find((candidate) => candidate.name === name);
  if (!def) {
    throw new Error(`Unknown domain tool: ${name}`);
  }
  return def;
}

export { createDomainToolsContext };
