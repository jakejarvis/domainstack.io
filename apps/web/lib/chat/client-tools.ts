/**
 * Client-side domain lookup tools for browser-based AI chat.
 *
 * Mirrors the server workflow tools, but calls tRPC from the browser
 * instead of durable workflow steps.
 */

import type { TRPCClient } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { tool, type Tool } from "ai";

import type { AppRouter } from "@/server/routers/_app";

import {
  DOMAIN_TOOL_DEFS,
  domainToolInputSchema,
  getDomainToolErrorMessage,
  type DomainToolInput,
  type DomainToolProcedure,
} from "./domain-tools";

type TRPCClientType = TRPCClient<AppRouter>;
type DomainOutputs = inferRouterOutputs<AppRouter>["domain"];

type DomainToolResult<P extends DomainToolProcedure> = DomainOutputs[P] extends {
  success: true;
  data: infer D;
}
  ? D | { error: string }
  : { error: string };

type ClientDomainToolSet = {
  [Def in (typeof DOMAIN_TOOL_DEFS)[number] as Def["name"]]: Tool<
    DomainToolInput,
    DomainToolResult<Def["procedure"]>
  >;
};

function makeClientDomainTool<TDef extends (typeof DOMAIN_TOOL_DEFS)[number]>(
  trpc: TRPCClientType,
  def: TDef,
) {
  return tool({
    description: def.description,
    inputSchema: domainToolInputSchema,
    execute: async ({ domain }: DomainToolInput) => {
      try {
        const result = await trpc.domain[def.procedure].query({ domain });
        if (!result.success) {
          return { error: result.error };
        }
        return result.data;
      } catch (err) {
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
