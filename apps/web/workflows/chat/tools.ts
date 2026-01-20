/**
 * Domain lookup tool steps for the chat workflow.
 * Each tool is a durable step with automatic retries.
 *
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
  // Import inside step to keep Node.js modules out of workflow sandbox
  const { createCaller } = await import("@/server/routers/_app");
  const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
  const result = await trpc.domain.getRegistration({ domain });
  return formatToolResult(result);
}

async function getDnsRecordsStep(
  domain: string,
  ctx: ToolContext,
): Promise<string> {
  "use step";
  const { createCaller } = await import("@/server/routers/_app");
  const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
  const result = await trpc.domain.getDnsRecords({ domain });
  return formatToolResult(result);
}

async function getHostingStep(
  domain: string,
  ctx: ToolContext,
): Promise<string> {
  "use step";
  const { createCaller } = await import("@/server/routers/_app");
  const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
  const result = await trpc.domain.getHosting({ domain });
  return formatToolResult(result);
}

async function getCertificatesStep(
  domain: string,
  ctx: ToolContext,
): Promise<string> {
  "use step";
  const { createCaller } = await import("@/server/routers/_app");
  const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
  const result = await trpc.domain.getCertificates({ domain });
  return formatToolResult(result);
}

async function getHeadersStep(
  domain: string,
  ctx: ToolContext,
): Promise<string> {
  "use step";
  const { createCaller } = await import("@/server/routers/_app");
  const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
  const result = await trpc.domain.getHeaders({ domain });
  return formatToolResult(result);
}

async function getSeoStep(domain: string, ctx: ToolContext): Promise<string> {
  "use step";
  const { createCaller } = await import("@/server/routers/_app");
  const trpc = createCaller({ req: undefined, ip: ctx.ip, session: null });
  const result = await trpc.domain.getSeo({ domain });
  return formatToolResult(result);
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
