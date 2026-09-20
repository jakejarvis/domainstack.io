import type { TRPCClient } from "@trpc/client";

import { analytics } from "@/lib/analytics/client";
import { getLookupErrorMessage } from "@/lib/constants/lookup-errors";
import { LOOKUP_PROCEDURES } from "@/lib/constants/lookup-procedures";
import type { AppRouter } from "@domainstack/api";

import {
  getDomainToolErrorMessage,
  type DOMAIN_TOOL_DEFS,
  type DomainToolResult,
  type DomainToolSection,
} from "./domain-tools";

// Kept apart from `client-tools.ts` so eager code (WebMCP) can run lookups
// without pulling in the `ai` package.

/**
 * Run one domain lookup section from the browser and shape the result the way
 * tools return it: the section data on success, `{ error }` otherwise. Shared
 * by browser chat and the WebMCP page tools.
 */
export async function runClientDomainLookup(
  trpc: TRPCClient<AppRouter>,
  def: (typeof DOMAIN_TOOL_DEFS)[number],
  domain: string,
): Promise<DomainToolResult<DomainToolSection>> {
  try {
    const result = await trpc.domain[LOOKUP_PROCEDURES[def.section]].query({ domain });
    if (!result.success) {
      return { error: getLookupErrorMessage(result.error) };
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
}
