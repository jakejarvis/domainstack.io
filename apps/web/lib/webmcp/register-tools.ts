import type { TRPCClient } from "@trpc/client";

import { runClientDomainLookup } from "@/lib/chat/client-lookup";
import { DOMAIN_TOOL_DEFS } from "@/lib/chat/domain-tools";
import type { AppRouter } from "@domainstack/api";

import type { ModelContext } from "./model-context";

const DOMAIN_PROPERTY = {
  type: "string",
  description: "Root domain to look up, e.g. example.com (no protocol or subdomain).",
} as const;

const INPUT_SCHEMA = {
  type: "object",
  properties: { domain: DOMAIN_PROPERTY },
  required: ["domain"],
} as const;

const SECTIONS = DOMAIN_TOOL_DEFS.map((def) => def.section);

const REPORT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    domain: DOMAIN_PROPERTY,
    sections: {
      type: "array",
      items: { type: "string", enum: SECTIONS },
      description: "Report sections to include. Omit for all sections.",
    },
  },
  required: ["domain"],
} as const;

// Lookups never change state, but their data (WHOIS, headers, SEO tags) is
// sourced from third-party servers.
const ANNOTATIONS = { readOnlyHint: true, untrustedContentHint: true } as const;

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
          annotations: ANNOTATIONS,
        },
        { signal },
      )
      .catch(() => {
        // Registration can be rejected (e.g. a duplicate name); WebMCP is
        // best-effort, so the site keeps working without it.
      });
  }

  modelContext
    .registerTool(
      {
        name: "get_domain_report",
        description:
          "Get a combined report for a domain in one call: registration, DNS, hosting, certificates, headers, and SEO. Use this tool when users want an overview or several aspects of a domain at once; use the individual get_* tools for a single aspect.",
        inputSchema: REPORT_INPUT_SCHEMA,
        execute: async (input, options) => {
          options.signal?.throwIfAborted();
          const domain = typeof input.domain === "string" ? input.domain.trim() : "";
          const requested = Array.isArray(input.sections) ? input.sections : [];
          const defs = requested.length
            ? DOMAIN_TOOL_DEFS.filter((def) => requested.includes(def.section))
            : DOMAIN_TOOL_DEFS;
          if (defs.length === 0) {
            return { error: `Unknown sections. Valid sections: ${SECTIONS.join(", ")}.` };
          }
          const results = await Promise.all(
            defs.map((def) => runClientDomainLookup(trpc, def, domain)),
          );
          options.signal?.throwIfAborted();
          return Object.fromEntries(defs.map((def, i) => [def.section, results[i]]));
        },
        annotations: ANNOTATIONS,
      },
      { signal },
    )
    .catch(() => {
      // Best-effort, as above.
    });
}
