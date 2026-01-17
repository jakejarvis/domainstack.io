import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { toRegistrableDomain } from "@/lib/normalize-domain";
import { checkRateLimit } from "@/lib/ratelimit/api";

/**
 * Domain input schema with normalization.
 * Validates and transforms domain input to registrable form.
 */
const domainSchema = z
  .string()
  .min(1, "Domain is required")
  .transform((val, ctx) => {
    const registrable = toRegistrableDomain(val);
    if (!registrable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Invalid domain. Please provide a valid registrable domain (e.g., example.com)",
      });
      return z.NEVER;
    }
    return registrable;
  });

/**
 * Base MCP handler for DomainStack.io
 *
 * Exposes domain intelligence tools to AI assistants via the Model Context Protocol.
 * Supports SSE and HTTP transports for real-time communication.
 */
const mcpHandler = createMcpHandler(
  (server) => {
    // Placeholder tool to verify setup works
    // Real tools will be added in domainstack.io-1cr.2
    server.tool(
      "get_registration",
      "Get WHOIS/RDAP registration data for a domain including registrar, creation date, expiration date, and nameservers",
      {
        domain: domainSchema.describe(
          "The domain to look up (e.g., example.com)",
        ),
      },
      async ({ domain }) => {
        // TODO: Implement actual lookup in domainstack.io-1cr.2
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  domain,
                  message:
                    "Tool skeleton - full implementation coming in next task",
                },
                null,
                2,
              ),
            },
          ],
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

  // Process the MCP request
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
