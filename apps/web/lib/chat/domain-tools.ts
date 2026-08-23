import type { inferRouterOutputs } from "@trpc/server";
import { z } from "zod";

import type { AppRouter } from "@/server/routers/_app";

/**
 * Shared domain-tool definitions used by the cloud workflow and browser chat.
 */
export const DOMAIN_TOOL_DEFS = [
  {
    name: "get_registration",
    procedure: "getRegistration",
    status: "Looking up WHOIS data",
    description:
      "Get WHOIS/RDAP registration data for a domain including registrar, creation date, expiration date, nameservers, and registrant information. Use this tool when users ask about domain ownership, registration, expiry, or who owns a domain.",
  },
  {
    name: "get_dns_records",
    procedure: "getDnsRecords",
    status: "Fetching DNS records",
    description:
      "Get DNS records for a domain including A, AAAA, CNAME, MX, TXT, NS, and SOA records. Use this tool when users ask about DNS configuration, IP addresses, mail servers, or nameservers.",
  },
  {
    name: "get_hosting",
    procedure: "getHosting",
    status: "Detecting hosting provider",
    description:
      "Detect hosting, DNS, CDN, and email providers for a domain by analyzing DNS records and HTTP headers. Use this tool when users ask where a site is hosted, what CDN they use, or who provides their email.",
  },
  {
    name: "get_certificates",
    procedure: "getCertificates",
    status: "Checking SSL certificate",
    description:
      "Get SSL/TLS certificate information for a domain including issuer, validity dates, and certificate chain. Use this tool when users ask about HTTPS, SSL certificates, security, or certificate expiry.",
  },
  {
    name: "get_headers",
    procedure: "getHeaders",
    status: "Analyzing HTTP headers",
    description:
      "Get HTTP response headers for a domain including security headers, caching headers, and server information. Use this tool when users ask about security headers, server software, caching, or HTTP configuration.",
  },
  {
    name: "get_seo",
    procedure: "getSeo",
    status: "Fetching SEO metadata",
    description:
      "Get SEO metadata for a domain including title, description, Open Graph tags, Twitter cards, and robots.txt rules. Use this tool when users ask about SEO, meta tags, social sharing, or how a site appears in search.",
  },
] as const;

export type DomainToolName = (typeof DOMAIN_TOOL_DEFS)[number]["name"];
export type DomainToolProcedure = (typeof DOMAIN_TOOL_DEFS)[number]["procedure"];

type DomainOutputs = inferRouterOutputs<AppRouter>["domain"];

/**
 * inferRouterOutputs widens `success: true | false` to `boolean`, so a
 * `success: true` check cannot pick the success branch. Infer from the
 * shared `data` property and drop the failure branch's `null`.
 */
type ExtractSuccessData<T> = T extends { data: infer D } ? NonNullable<D> : never;

export type DomainToolResult<P extends DomainToolProcedure> =
  | ExtractSuccessData<DomainOutputs[P]>
  | { error: string };

export const domainToolInputSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .describe(
      "The root domain name to look up (e.g., 'example.com', 'example.org'). Must be a root domain, NOT a subdomain - WHOIS lookups don't work for subdomains like 'www.example.com' or 'api.example.com'. Do not include protocol (http/https).",
    ),
});

const DOMAIN_TOOL_STATUS = Object.fromEntries(
  DOMAIN_TOOL_DEFS.map((def) => [def.name, def.status]),
) as Record<DomainToolName, string>;

const EXTRA_TOOL_STATUS: Record<string, string> = {
  web_search: "Searching the web",
};

const TRPC_ERROR_CODES = new Set([
  "PARSE_ERROR",
  "BAD_REQUEST",
  "INTERNAL_SERVER_ERROR",
  "NOT_IMPLEMENTED",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "UNAUTHORIZED",
  "PAYMENT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "TIMEOUT",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "UNPROCESSABLE_CONTENT",
  "PRECONDITION_REQUIRED",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);

export type DomainToolInput = z.infer<typeof domainToolInputSchema>;

/**
 * Normalize a UI tool part to the `tool-${name}` key used by status labels.
 * Static tools already use that type; AI SDK dynamic-tool parts store the
 * name on `toolName` instead.
 */
export function getToolPartType(part: { type: string; toolName?: unknown }): string {
  if (
    part.type === "dynamic-tool" &&
    typeof part.toolName === "string" &&
    part.toolName.length > 0
  ) {
    return `tool-${part.toolName}`;
  }
  return part.type;
}

export function getDomainToolStatus(type: string): string {
  const toolName = type.replace(/^tool-/, "");
  return DOMAIN_TOOL_STATUS[toolName as DomainToolName] ?? EXTRA_TOOL_STATUS[toolName] ?? toolName;
}

function asTrpcErrorCode(code: unknown): string | undefined {
  return typeof code === "string" && TRPC_ERROR_CODES.has(code) ? code : undefined;
}

export function getTrpcErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }

  if ("code" in err) {
    const code = asTrpcErrorCode(err.code);
    if (code) {
      return code;
    }
  }

  if ("data" in err && typeof err.data === "object" && err.data !== null && "code" in err.data) {
    return asTrpcErrorCode(err.data.code);
  }

  return undefined;
}

export function getDomainToolErrorMessage(err: unknown): string {
  const code = getTrpcErrorCode(err);
  if (code === "TOO_MANY_REQUESTS") {
    return "Rate limit exceeded. Please wait a moment and try again.";
  }
  if (code === "BAD_REQUEST") {
    return "Please provide a valid root domain (e.g., example.com).";
  }
  return "Unable to fetch data. Please try again.";
}

export function createDomainToolsContext<T>(context: T): Record<DomainToolName, T> {
  return Object.fromEntries(DOMAIN_TOOL_DEFS.map((def) => [def.name, context])) as Record<
    DomainToolName,
    T
  >;
}
