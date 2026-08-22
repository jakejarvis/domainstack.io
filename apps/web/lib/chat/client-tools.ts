/**
 * Client-side domain lookup tools for browser-based AI chat.
 *
 * Mirrors the server workflow tools, but calls tRPC from the browser
 * instead of durable workflow steps.
 */

import type { TRPCClient } from "@trpc/client";
import { tool, type Tool } from "ai";

import type { AppRouter } from "@/server/routers/_app";

import { DOMAIN_TOOL_DEFS, domainToolInputSchema, getDomainToolErrorMessage } from "./domain-tools";

type TRPCClientType = TRPCClient<AppRouter>;

export function createClientDomainTools(trpc: TRPCClientType) {
  return Object.fromEntries(
    DOMAIN_TOOL_DEFS.map((def) => [
      def.name,
      tool({
        description: def.description,
        inputSchema: domainToolInputSchema,
        execute: async ({ domain }: { domain: string }) => {
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
      }),
    ]),
  ) as Record<(typeof DOMAIN_TOOL_DEFS)[number]["name"], Tool>;
}

export type ClientDomainTools = ReturnType<typeof createClientDomainTools>;
