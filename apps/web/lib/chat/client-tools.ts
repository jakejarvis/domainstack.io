/**
 * Client-side domain lookup tools for browser-based AI chat.
 *
 * Mirrors the server workflow tools, but calls tRPC from the browser
 * instead of durable workflow steps.
 */

import type { TRPCClient } from "@trpc/client";
import { tool, type Tool } from "ai";

import { analytics } from "@/lib/analytics/client";
import { LOOKUP_ERROR_MESSAGES } from "@/lib/constants/lookup-errors";
import type { AppRouter } from "@domainstack/api";

import {
  DOMAIN_TOOL_DEFS,
  domainToolInputSchema,
  getDomainToolErrorMessage,
  type DomainToolInput,
  type DomainToolResult,
} from "./domain-tools";

type TRPCClientType = TRPCClient<AppRouter>;

const PROCEDURES = {
  registration: "getRegistration",
  dns: "getDnsRecords",
  hosting: "getHosting",
  certificates: "getCertificates",
  headers: "getHeaders",
  seo: "getSeo",
} as const;

type ClientDomainToolSet = {
  [Def in (typeof DOMAIN_TOOL_DEFS)[number] as Def["name"]]: Tool<
    DomainToolInput,
    DomainToolResult<Def["section"]>
  >;
};

function makeClientDomainTool<TDef extends (typeof DOMAIN_TOOL_DEFS)[number]>(
  trpc: TRPCClientType,
  def: TDef,
) {
  return tool({
    description: def.description,
    inputSchema: domainToolInputSchema,
    strict: true,
    execute: async ({ domain }: DomainToolInput) => {
      try {
        const result = await trpc.domain[PROCEDURES[def.section]].query({ domain });
        if (!result.success) {
          return { error: LOOKUP_ERROR_MESSAGES[result.error] };
        }
        return result.data;
      } catch (err) {
        analytics.trackException(err, {
          context: "client-domain-tool",
          tool: def.name,
          domain,
        });
        return { error: getDomainToolErrorMessage(err) };
      }
    },
  });
}

export function createClientDomainTools(trpc: TRPCClientType): ClientDomainToolSet {
  return Object.fromEntries(
    DOMAIN_TOOL_DEFS.map((def) => [def.name, makeClientDomainTool(trpc, def)]),
  ) as ClientDomainToolSet;
}

export type ClientDomainTools = ReturnType<typeof createClientDomainTools>;
