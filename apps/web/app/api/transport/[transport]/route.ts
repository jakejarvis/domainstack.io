import { instrument } from "@posthog/mcp";
import { ipAddress } from "@vercel/functions";
import { createMcpHandler } from "mcp-handler";
import { PostHog } from "posthog-node";
import { z } from "zod";

import { LOOKUP_PROCEDURES } from "@/lib/constants/lookup-procedures";
import { MCP_SECTION_TOOLS } from "@/lib/constants/mcp-tools";
import { checkRateLimit } from "@/lib/ratelimit/api";
import { createCaller } from "@domainstack/api";
import type { Context } from "@domainstack/api";
import { type Section, SECTION_IDS } from "@domainstack/constants";

export const maxDuration = 800;

const posthog = process.env.POSTHOG_PROJECT_TOKEN
  ? new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
      host: process.env.POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
    })
  : null;

/**
 * Domain input schema for MCP tools.
 * Uses simple string validation - normalization happens in tRPC layer.
 */
const domainSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
});

const sectionsSchema = z
  .array(z.enum(SECTION_IDS))
  .optional()
  .describe("Sections to include in the report. If omitted, all sections are included.");

/**
 * Helper to format SwrResult for MCP tool response.
 *
 * The router's internal metadata (`cached`, `stale`) sits alongside `data` on
 * the result rather than inside it, so serializing `data` on its own already
 * gives MCP consumers a clean payload.
 */
function formatToolResponse(result: { success: boolean; data?: unknown; error?: string }) {
  if (!result.success) {
    return {
      content: [{ type: "text" as const, text: result.error ?? "Unknown error" }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(result.data ?? {}, null, 2) }],
  };
}

/**
 * Creates MCP handler with tRPC caller bound to request context.
 * This ensures rate limiting and auth work correctly.
 */
function createMcpHandlerWithContext(request: Request) {
  // Create tRPC context from the incoming request
  const ip = ipAddress(request) ?? null;
  const ctx: Context = { req: request, ip, session: null };
  const trpc = createCaller(ctx);

  return createMcpHandler(
    (server) => {
      if (posthog) instrument(server, posthog);

      for (const { section, name, title, description } of MCP_SECTION_TOOLS) {
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
          async ({ domain }) =>
            formatToolResponse(await trpc.domain[LOOKUP_PROCEDURES[section]]({ domain })),
        );
      }

      // ─────────────────────────────────────────────────────────────────────
      // Domain Report Bundle Tool
      // ─────────────────────────────────────────────────────────────────────
      server.registerTool(
        "domain_report",
        {
          title: "Full Report",
          description:
            "Get a comprehensive domain report combining multiple data sources. Returns registration, DNS, hosting, certificates, headers, and SEO data in a single call. Use the sections parameter to request only specific data.",
          inputSchema: domainSchema.extend({
            sections: sectionsSchema,
          }),
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
                const result = await trpc.domain[LOOKUP_PROCEDURES[section]]({ domain });
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
    },
  );
}

/**
 * Rate-limited MCP handler wrapper.
 * Applies rate limiting (30 req/min per user/IP) before processing MCP requests.
 */
async function handler(request: Request): Promise<Response> {
  // Apply rate limiting before processing MCP requests
  const rateLimit = await checkRateLimit(request, {
    name: "api:mcp-handler",
    requests: 30,
    window: "1 m",
  });

  if (!rateLimit.success) {
    return rateLimit.error;
  }

  // Create handler with request context and process
  const mcpHandler = createMcpHandlerWithContext(request);
  const response = await mcpHandler(request);

  // Flush PostHog events captured during this invocation (serverless — SIGTERM unreliable)
  if (posthog) await posthog.flush();

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
