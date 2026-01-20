/**
 * Domain lookup tools for the chat workflow.
 *
 * Each tool wraps a durable step function with automatic retries.
 * Node.js modules (like tRPC, database) are imported INSIDE step functions
 * to keep them out of the workflow sandbox.
 */

import { tool } from "ai";
import { z } from "zod";

const domainSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
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
  logger.error({ err, domain, tool: toolName }, "tool step failed");

  // Sanitize error messages to avoid leaking internal details
  const rawMessage = err instanceof Error ? err.message : "Unknown error";
  const lowerMessage = rawMessage.toLowerCase();

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
 */
export function createDomainTools(ctx: ToolContext) {
  return {
    getRegistration: tool({
      description:
        "Get WHOIS/RDAP registration data for a domain including registrar, creation date, expiration date, nameservers, and registrant information",
      inputSchema: domainSchema,
      execute: async ({ domain }) => getRegistrationStep(domain, ctx),
    }),
    getDnsRecords: tool({
      description:
        "Get DNS records for a domain including A, AAAA, CNAME, MX, TXT, NS, and SOA records",
      inputSchema: domainSchema,
      execute: async ({ domain }) => getDnsRecordsStep(domain, ctx),
    }),
    getHosting: tool({
      description:
        "Detect hosting, DNS, CDN, and email providers for a domain by analyzing DNS records and HTTP headers",
      inputSchema: domainSchema,
      execute: async ({ domain }) => getHostingStep(domain, ctx),
    }),
    getCertificates: tool({
      description:
        "Get SSL/TLS certificate information for a domain including issuer, validity dates, and certificate chain",
      inputSchema: domainSchema,
      execute: async ({ domain }) => getCertificatesStep(domain, ctx),
    }),
    getHeaders: tool({
      description:
        "Get HTTP response headers for a domain including security headers, caching headers, and server information",
      inputSchema: domainSchema,
      execute: async ({ domain }) => getHeadersStep(domain, ctx),
    }),
    getSeo: tool({
      description:
        "Get SEO metadata for a domain including title, description, Open Graph tags, Twitter cards, and robots.txt rules",
      inputSchema: domainSchema,
      execute: async ({ domain }) => getSeoStep(domain, ctx),
    }),
  };
}
