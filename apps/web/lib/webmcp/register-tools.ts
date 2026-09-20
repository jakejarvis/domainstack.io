import type { TRPCClient } from "@trpc/client";

import { runClientDomainLookup } from "@/lib/chat/client-lookup";
import { DOMAIN_TOOL_DEFS } from "@/lib/chat/domain-tools";
import type { AppRouter } from "@domainstack/api";

import type { ModelContext } from "./model-context";

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    domain: {
      type: "string",
      description: "Root domain to look up, e.g. example.com (no protocol or subdomain).",
    },
  },
  required: ["domain"],
} as const;

/** Registers the domain lookup tools; aborting `signal` unregisters them. */
export function registerDomainTools(
  modelContext: ModelContext,
  trpc: TRPCClient<AppRouter>,
  signal: AbortSignal,
) {
  for (const def of DOMAIN_TOOL_DEFS) {
    modelContext
      .registerTool(
        {
          name: def.name,
          description: def.description,
          inputSchema: INPUT_SCHEMA,
          execute: async (input) => {
            const domain = typeof input.domain === "string" ? input.domain.trim() : "";
            return runClientDomainLookup(trpc, def, domain);
          },
          // Lookups never change state, but their data (WHOIS, headers, SEO
          // tags) is sourced from third-party servers.
          annotations: { readOnlyHint: true, untrustedContentHint: true },
        },
        { signal },
      )
      .catch(() => {
        // Registration can be rejected (e.g. a duplicate name); WebMCP is
        // best-effort, so the site keeps working without it.
      });
  }
}
