/**
 * Domain lookup tools for the chat workflow.
 *
 * Each tool wraps a durable step function. The Workflow SDK provides
 * automatic retries for failed steps by default.
 *
 * Node.js modules (like tRPC, database) are imported INSIDE step functions
 * to keep them out of the workflow sandbox.
 */

import { tool } from "ai";
import { z } from "zod";

/**
 * Schema for domain tool inputs.
 * Using .describe() to help LLMs understand the expected format.
 * See: https://ai-sdk.dev/docs/ai-sdk-core/prompt-engineering#tool--structured-data-schemas
 */
const domainSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .describe(
      "The root domain name to look up (e.g., 'example.com', 'example.org'). Must be a root domain, NOT a subdomain - WHOIS lookups don't work for subdomains like 'www.example.com' or 'api.example.com'. Do not include protocol (http/https).",
    ),
});

/**
 * Helper to format tRPC result for tool response.
 */
function formatToolResult(result: {
  success: boolean;
  data?: unknown;
  error?: string;
}): string {
  if (!result.success) {
    return JSON.stringify({ error: result.error ?? "Unknown error" });
  }

  const data = { ...(result.data as Record<string, unknown>) };
  delete data.rateLimit;
  delete data.cached;
  delete data.stale;

  return JSON.stringify(data, null, 2);
}

/**
 * Check if an error is an expected network/domain error vs an unexpected bug.
 * Expected errors: network issues, DNS failures, timeouts, rate limits, etc.
 * Unexpected errors: import failures, type errors, programming bugs
 */
function isExpectedError(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const expectedPatterns = [
    "timeout",
    "timed out",
    "rate limit",
    "not found",
    "enotfound",
    "dns",
    "certificate",
    "ssl",
    "tls",
    "refused",
    "unreachable",
    "network",
    "econnreset",
    "econnrefused",
    "socket",
    "fetch failed",
  ];
  return expectedPatterns.some((pattern) => lowerMessage.includes(pattern));
}

/**
 * Format an error for tool response and log it.
 * Returns a JSON string with sanitized error message for the AI to interpret.
 * Internal details (hostnames, database errors, etc.) are logged but not exposed.
 */
async function handleToolError(
  err: unknown,
  domain: string,
  toolName: string,
): Promise<string> {
  // Import logger inside to keep Node.js modules out of workflow sandbox
  const { createLogger } = await import("@/lib/logger/server");
  const logger = createLogger({ source: "chat/tools" });

  // Sanitize error messages to avoid leaking internal details
  const rawMessage = err instanceof Error ? err.message : "Unknown error";
  const lowerMessage = rawMessage.toLowerCase();

  // Log at appropriate level: warn for expected errors, error for unexpected
  const isExpected = isExpectedError(rawMessage);
  if (isExpected) {
    logger.warn({ err, domain, tool: toolName }, "tool step failed (expected)");
  } else {
    logger.error(
      { err, domain, tool: toolName },
      "tool step failed (unexpected)",
    );
  }

  let userMessage = "Unable to fetch data. Please try again.";

  // Map specific error patterns to user-friendly messages
  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    userMessage = "Request timed out. The domain may be slow to respond.";
  } else if (lowerMessage.includes("rate limit")) {
    userMessage = "Rate limit exceeded. Please wait a moment and try again.";
  } else if (
    lowerMessage.includes("not found") ||
    lowerMessage.includes("enotfound") ||
    lowerMessage.includes("dns")
  ) {
    userMessage = `Could not resolve ${domain}. The domain may not exist or DNS may be misconfigured.`;
  } else if (
    lowerMessage.includes("certificate") ||
    lowerMessage.includes("ssl") ||
    lowerMessage.includes("tls")
  ) {
    userMessage = `Could not establish secure connection to ${domain}.`;
  } else if (
    lowerMessage.includes("refused") ||
    lowerMessage.includes("unreachable")
  ) {
    userMessage = `Could not connect to ${domain}. The server may be down.`;
  }

  return JSON.stringify({ error: userMessage });
}

/**
 * Context passed to tool steps.
 * Must be serializable - no functions or complex objects.
 */
export interface ToolContext {
  ip: string | null;
}

// Step functions for each domain lookup
// tRPC caller is created INSIDE each step to avoid workflow sandbox issues

async function getRegistrationStep(
  domain: string,
  ctx: ToolContext,
): Promise<string> {
  "use step";
  try {
    const { createCaller } = await import("@/server/routers/_app");
    const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
    const result = await trpc.domain.getRegistration({ domain });
    return formatToolResult(result);
  } catch (err) {
    return handleToolError(err, domain, "getRegistration");
  }
}

async function getDnsRecordsStep(
  domain: string,
  ctx: ToolContext,
): Promise<string> {
  "use step";
  try {
    const { createCaller } = await import("@/server/routers/_app");
    const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
    const result = await trpc.domain.getDnsRecords({ domain });
    return formatToolResult(result);
  } catch (err) {
    return handleToolError(err, domain, "getDnsRecords");
  }
}

async function getHostingStep(
  domain: string,
  ctx: ToolContext,
): Promise<string> {
  "use step";
  try {
    const { createCaller } = await import("@/server/routers/_app");
    const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
    const result = await trpc.domain.getHosting({ domain });
    return formatToolResult(result);
  } catch (err) {
    return handleToolError(err, domain, "getHosting");
  }
}

async function getCertificatesStep(
  domain: string,
  ctx: ToolContext,
): Promise<string> {
  "use step";
  try {
    const { createCaller } = await import("@/server/routers/_app");
    const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
    const result = await trpc.domain.getCertificates({ domain });
    return formatToolResult(result);
  } catch (err) {
    return handleToolError(err, domain, "getCertificates");
  }
}

async function getHeadersStep(
  domain: string,
  ctx: ToolContext,
): Promise<string> {
  "use step";
  try {
    const { createCaller } = await import("@/server/routers/_app");
    const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
    const result = await trpc.domain.getHeaders({ domain });
    return formatToolResult(result);
  } catch (err) {
    return handleToolError(err, domain, "getHeaders");
  }
}

async function getSeoStep(domain: string, ctx: ToolContext): Promise<string> {
  "use step";
  try {
    const { createCaller } = await import("@/server/routers/_app");
    const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
    const result = await trpc.domain.getSeo({ domain });
    return formatToolResult(result);
  } catch (err) {
    return handleToolError(err, domain, "getSeo");
  }
}

/**
 * Creates domain intelligence tools bound to a tool context.
 * Each tool executes as a durable workflow step with automatic retries.
 *
 * Tool configuration follows AI SDK best practices:
 * - strict: true - ensures valid tool calls when supported by provider
 * - Descriptive descriptions - help LLM understand when/how to use each tool
 * - Schema with .describe() - helps LLM understand expected input format
 *
 * See: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#strict-mode
 */
export function createDomainToolset(ctx: ToolContext) {
  return {
    getRegistration: tool({
      description:
        "Get WHOIS/RDAP registration data for a domain including registrar, creation date, expiration date, nameservers, and registrant information. Use this tool when users ask about domain ownership, registration, expiry, or who owns a domain.",
      inputSchema: domainSchema,
      strict: true,
      execute: async ({ domain }) => getRegistrationStep(domain, ctx),
    }),
    getDnsRecords: tool({
      description:
        "Get DNS records for a domain including A, AAAA, CNAME, MX, TXT, NS, and SOA records. Use this tool when users ask about DNS configuration, IP addresses, mail servers, or nameservers.",
      inputSchema: domainSchema,
      strict: true,
      execute: async ({ domain }) => getDnsRecordsStep(domain, ctx),
    }),
    getHosting: tool({
      description:
        "Detect hosting, DNS, CDN, and email providers for a domain by analyzing DNS records and HTTP headers. Use this tool when users ask where a site is hosted, what CDN they use, or who provides their email.",
      inputSchema: domainSchema,
      strict: true,
      execute: async ({ domain }) => getHostingStep(domain, ctx),
    }),
    getCertificates: tool({
      description:
        "Get SSL/TLS certificate information for a domain including issuer, validity dates, and certificate chain. Use this tool when users ask about HTTPS, SSL certificates, security, or certificate expiry.",
      inputSchema: domainSchema,
      strict: true,
      execute: async ({ domain }) => getCertificatesStep(domain, ctx),
    }),
    getHeaders: tool({
      description:
        "Get HTTP response headers for a domain including security headers, caching headers, and server information. Use this tool when users ask about security headers, server software, caching, or HTTP configuration.",
      inputSchema: domainSchema,
      strict: true,
      execute: async ({ domain }) => getHeadersStep(domain, ctx),
    }),
    getSeo: tool({
      description:
        "Get SEO metadata for a domain including title, description, Open Graph tags, Twitter cards, and robots.txt rules. Use this tool when users ask about SEO, meta tags, social sharing, or how a site appears in search.",
      inputSchema: domainSchema,
      strict: true,
      execute: async ({ domain }) => getSeoStep(domain, ctx),
    }),
  };
}
