import { instrument } from "@posthog/mcp";
import { ipAddress } from "@vercel/functions";
import { createMcpHandler } from "mcp-handler";
import { after } from "next/server";
import { PostHog } from "posthog-node";

import {
  domainSchema,
  MCP_REPORT_TOOL,
  MCP_SECTION_TOOLS,
  MCP_TOOLS,
  reportSchema,
} from "@/lib/constants/mcp-tools";
import { checkRateLimit } from "@/lib/ratelimit/api";
import { type Section, SECTION_IDS } from "@domainstack/constants";
import { lookupSection } from "@domainstack/core/lookup";
import { toRegistrableDomain } from "@domainstack/utils/domain";

export const maxDuration = 800;

const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY
  ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
    })
  : null;

/** Rate-limit MCP requests before creating tools bound to the client IP. */
async function handler(request: Request): Promise<Response> {
  const rateLimit = await checkRateLimit(request, {
    name: "api:mcp-handler",
    requests: 30,
    window: "1 m",
  });

  if (!rateLimit.success) {
    return rateLimit.error;
  }

  const identifier = ipAddress(request) ?? null;

  function lookupDomainSection(section: Section, rawDomain: string) {
    const domain = toRegistrableDomain(rawDomain);
    if (!domain) {
      throw new Error('"domain" must be a valid registrable domain (e.g. example.com)');
    }
    return lookupSection(section, domain, { identifier });
  }

  const response = await createMcpHandler(
    (server) => {
      if (posthog) instrument(server, posthog);

      for (const section of SECTION_IDS) {
        const { name, title, description } = MCP_SECTION_TOOLS[section];
        server.registerTool(
          name,
          {
            title,
            description,
            inputSchema: domainSchema,
            annotations: {
              readOnlyHint: true,
              idempotentHint: true,
            },
          },
          async ({ domain }) => {
            const result = await lookupDomainSection(section, domain);
            return result.success
              ? {
                  content: [
                    { type: "text" as const, text: JSON.stringify(result.data ?? {}, null, 2) },
                  ],
                }
              : {
                  content: [{ type: "text" as const, text: result.error ?? "Unknown error" }],
                  isError: true,
                };
          },
        );
      }

      // ─────────────────────────────────────────────────────────────────────
      // Domain Report Bundle Tool
      // ─────────────────────────────────────────────────────────────────────
      server.registerTool(
        MCP_REPORT_TOOL.name,
        {
          title: MCP_REPORT_TOOL.title,
          description: MCP_REPORT_TOOL.description,
          inputSchema: reportSchema,
          annotations: {
            readOnlyHint: true,
            idempotentHint: true,
          },
        },
        async ({ domain, sections }) => {
          // Default to all sections if not specified
          const requestedSections: Section[] =
            sections && sections.length > 0 ? sections : [...SECTION_IDS];

          // Execute requested sections in parallel
          const results = await Promise.all(
            requestedSections.map(async (section) => {
              try {
                const result = await lookupDomainSection(section, domain);
                if (result.success) {
                  // `cached`/`stale` sit beside `data` on the result, not in it
                  return { section, success: true, data: result.data ?? null };
                }
                return { section, success: false, error: result.error };
              } catch (err) {
                return {
                  section,
                  success: false,
                  error: err instanceof Error ? err.message : "Unknown error",
                };
              }
            }),
          );

          // Build response object
          const report: Record<string, unknown> = { domain };
          const errors: { section: string; error: string }[] = [];

          for (const result of results) {
            if (result.success) {
              report[result.section] = result.data;
            } else {
              report[result.section] = null;
              errors.push({
                section: result.section,
                error: result.error ?? "Unknown error",
              });
            }
          }

          // Include errors summary if any sections failed
          if (errors.length > 0) {
            report.errors = errors;
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }],
            // Mark as partial error if some sections failed but not all
            isError: errors.length === requestedSections.length,
          };
        },
      );
    },
    {
      serverInfo: {
        name: "domainstack",
        version: `1.0.0${process.env.VERCEL_GIT_COMMIT_SHA ? `-${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ""}`,
      },
      capabilities: {
        tools: {},
      },
      verboseLogs: process.env.NODE_ENV === "development",
      experimental_webMcp: {
        tools: MCP_TOOLS.map((tool) => tool.name),
      },
    },
  )(request);

  // Flush PostHog events captured during this invocation (serverless — SIGTERM unreliable)
  if (posthog) {
    after(() => posthog.flush());
  }

  // Add rate limit headers to successful responses
  if (rateLimit.headers) {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(rateLimit.headers)) {
      headers.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}

export { handler as GET, handler as POST, handler as DELETE };
