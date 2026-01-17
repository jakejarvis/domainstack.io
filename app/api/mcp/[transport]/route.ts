import { ipAddress } from "@vercel/functions";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ratelimit/api";
import { createCaller } from "@/server/routers/_app";
import type { Context } from "@/trpc/init";

/**
 * Domain input schema for MCP tools.
 * Uses simple string validation - normalization happens in tRPC layer.
 */
const domainSchema = z.string().min(1, "Domain is required");

/**
 * Available sections for domain_report bundle tool.
 */
const REPORT_SECTIONS = [
  "dns",
  "registration",
  "hosting",
  "certificates",
  "headers",
  "seo",
] as const;

type ReportSection = (typeof REPORT_SECTIONS)[number];

const sectionsSchema = z
  .array(z.enum(REPORT_SECTIONS))
  .optional()
  .describe(
    "Sections to include in the report. If omitted, all sections are included.",
  );

/**
 * Helper to format SwrResult for MCP tool response.
 * Strips internal metadata (rateLimit, cached, stale) and returns clean JSON.
 */
function formatToolResponse(result: {
  success: boolean;
  data?: unknown;
  error?: string;
}) {
  if (!result.success) {
    return {
      content: [
        { type: "text" as const, text: result.error ?? "Unknown error" },
      ],
      isError: true,
    };
  }

  // Strip internal metadata that's not useful for MCP consumers
  const { ...data } = result.data as Record<string, unknown>;
  delete data.rateLimit;
  delete data.cached;
  delete data.stale;

  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
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
      // ─────────────────────────────────────────────────────────────────────
      // Domain Registration Tool
      // ─────────────────────────────────────────────────────────────────────
      server.tool(
        "domain_registration",
        "Get WHOIS/RDAP registration data for a domain including registrar, creation date, expiration date, nameservers, and registrant information",
        {
          domain: domainSchema.describe(
            "Domain to look up (e.g., example.com)",
          ),
        },
        async ({ domain }) => {
          const result = await trpc.domain.getRegistration({ domain });
          return formatToolResponse(result);
        },
      );

      // ─────────────────────────────────────────────────────────────────────
      // DNS Records Tool
      // ─────────────────────────────────────────────────────────────────────
      server.tool(
        "domain_dns",
        "Get DNS records for a domain including A, AAAA, CNAME, MX, TXT, NS, and SOA records",
        {
          domain: domainSchema.describe(
            "Domain to look up (e.g., example.com)",
          ),
        },
        async ({ domain }) => {
          const result = await trpc.domain.getDnsRecords({ domain });
          return formatToolResponse(result);
        },
      );

      // ─────────────────────────────────────────────────────────────────────
      // Hosting Detection Tool
      // ─────────────────────────────────────────────────────────────────────
      server.tool(
        "domain_hosting",
        "Detect hosting, DNS, CDN, and email providers for a domain by analyzing DNS records and HTTP headers",
        {
          domain: domainSchema.describe(
            "Domain to look up (e.g., example.com)",
          ),
        },
        async ({ domain }) => {
          const result = await trpc.domain.getHosting({ domain });
          return formatToolResponse(result);
        },
      );

      // ─────────────────────────────────────────────────────────────────────
      // SSL Certificates Tool
      // ─────────────────────────────────────────────────────────────────────
      server.tool(
        "domain_certificates",
        "Get SSL/TLS certificate information for a domain including issuer, validity dates, and certificate chain",
        {
          domain: domainSchema.describe(
            "Domain to look up (e.g., example.com)",
          ),
        },
        async ({ domain }) => {
          const result = await trpc.domain.getCertificates({ domain });
          return formatToolResponse(result);
        },
      );

      // ─────────────────────────────────────────────────────────────────────
      // HTTP Headers Tool
      // ─────────────────────────────────────────────────────────────────────
      server.tool(
        "domain_headers",
        "Get HTTP response headers for a domain including security headers, caching headers, and server information",
        {
          domain: domainSchema.describe(
            "Domain to look up (e.g., example.com)",
          ),
        },
        async ({ domain }) => {
          const result = await trpc.domain.getHeaders({ domain });
          return formatToolResponse(result);
        },
      );

      // ─────────────────────────────────────────────────────────────────────
      // SEO Data Tool
      // ─────────────────────────────────────────────────────────────────────
      server.tool(
        "domain_seo",
        "Get SEO metadata for a domain including title, description, Open Graph tags, Twitter cards, and robots.txt rules",
        {
          domain: domainSchema.describe(
            "Domain to look up (e.g., example.com)",
          ),
        },
        async ({ domain }) => {
          const result = await trpc.domain.getSeo({ domain });
          return formatToolResponse(result);
        },
      );

      // ─────────────────────────────────────────────────────────────────────
      // Domain Report Bundle Tool
      // ─────────────────────────────────────────────────────────────────────
      server.tool(
        "domain_report",
        "Get a comprehensive domain report combining multiple data sources. Returns registration, DNS, hosting, certificates, headers, and SEO data in a single call. Use the sections parameter to request only specific data.",
        {
          domain: domainSchema.describe(
            "Domain to look up (e.g., example.com)",
          ),
          sections: sectionsSchema,
        },
        async ({ domain, sections }) => {
          // Default to all sections if not specified
          const requestedSections: ReportSection[] =
            sections && sections.length > 0 ? sections : [...REPORT_SECTIONS];

          // Define section fetchers
          const sectionFetchers: Record<
            ReportSection,
            () => Promise<{ success: boolean; data?: unknown; error?: string }>
          > = {
            registration: () => trpc.domain.getRegistration({ domain }),
            dns: () => trpc.domain.getDnsRecords({ domain }),
            hosting: () => trpc.domain.getHosting({ domain }),
            certificates: () => trpc.domain.getCertificates({ domain }),
            headers: () => trpc.domain.getHeaders({ domain }),
            seo: () => trpc.domain.getSeo({ domain }),
          };

          // Execute requested sections in parallel
          const results = await Promise.all(
            requestedSections.map(async (section) => {
              try {
                const result = await sectionFetchers[section]();
                if (result.success) {
                  // Strip internal metadata
                  const { ...data } = result.data as Record<string, unknown>;
                  delete data.rateLimit;
                  delete data.cached;
                  delete data.stale;
                  return { section, success: true, data };
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
            content: [
              { type: "text" as const, text: JSON.stringify(report, null, 2) },
            ],
            // Mark as partial error if some sections failed but not all
            isError: errors.length === requestedSections.length,
          };
        },
      );
    },
    {
      serverInfo: {
        name: "domainstack",
        version: "1.0.0",
      },
      capabilities: {
        tools: {},
      },
    },
    {
      redisUrl: process.env.UPSTASH_REDIS_REST_URL,
      basePath: "/api/mcp",
      maxDuration: 60,
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
    requests: 30,
    window: "1 m",
  });

  if (!rateLimit.success) {
    return rateLimit.error;
  }

  // Create handler with request context and process
  const mcpHandler = createMcpHandlerWithContext(request);
  const response = await mcpHandler(request);

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
