/**
 * Client-side domain lookup tools for browser-based AI chat.
 *
 * Mirrors the server workflow tools, but calls tRPC from the browser
 * instead of durable workflow steps.
 */

import type { TRPCClient } from "@trpc/client";
import { tool, type Tool } from "ai";

import type { AppRouter } from "@domainstack/api";

import { runClientDomainLookup } from "./client-lookup";
import {
  DOMAIN_TOOL_DEFS,
  domainToolInputSchema,
  type DomainToolInput,
  type DomainToolResult,
} from "./domain-tools";

type TRPCClientType = TRPCClient<AppRouter>;

type ClientDomainToolSet = {
  [Def in (typeof DOMAIN_TOOL_DEFS)[number] as Def["name"]]: Tool<
    DomainToolInput,
    DomainToolResult<Def["section"]>
  >;
};

function makeClientDomainTool(trpc: TRPCClientType, def: (typeof DOMAIN_TOOL_DEFS)[number]) {
  return tool({
    description: def.description,
    inputSchema: domainToolInputSchema,
    strict: true,
    execute: ({ domain }: DomainToolInput) => runClientDomainLookup(trpc, def, domain),
  });
}

export function createClientDomainTools(trpc: TRPCClientType): ClientDomainToolSet {
  return Object.fromEntries(
    DOMAIN_TOOL_DEFS.map((def) => [def.name, makeClientDomainTool(trpc, def)]),
  ) as ClientDomainToolSet;
}
