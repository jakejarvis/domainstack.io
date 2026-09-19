import { z } from "zod";

import { getLookupErrorMessage } from "@/lib/constants/lookup-errors";
import { getTrpcErrorCode } from "@/lib/trpc/errors";
import type { LookupResult } from "@domainstack/core/lookup";

/**
 * Shared domain-tool definitions used by the cloud workflow and browser chat.
 * `section` names the report section the tool looks up.
 */
export const DOMAIN_TOOL_DEFS = [
  {
    name: "get_registration",
    section: "registration",
    status: "Looking up WHOIS data",
    description:
      "Get WHOIS/RDAP registration data for a domain including registrar, creation date, expiration date, nameservers, and registrant information. Use this tool when users ask about domain ownership, registration, expiry, or who owns a domain.",
  },
  {
    name: "get_dns_records",
    section: "dns",
    status: "Fetching DNS records",
    description:
      "Get DNS records for a domain including A, AAAA, MX, TXT, and NS records. Use this tool when users ask about DNS configuration, IP addresses, mail servers, or nameservers.",
  },
  {
    name: "get_hosting",
    section: "hosting",
    status: "Detecting hosting provider",
    description:
      "Detect hosting, DNS, CDN, and email providers for a domain by analyzing DNS records and HTTP headers. Use this tool when users ask where a site is hosted, what CDN they use, or who provides their email.",
  },
  {
    name: "get_certificates",
    section: "certificates",
    status: "Checking SSL certificate",
    description:
      "Get SSL/TLS certificate information for a domain including issuer, validity, TLS protocol, and certificate chain. Use this tool when users ask about HTTPS, SSL certificates, security, or certificate expiry.",
  },
  {
    name: "get_headers",
    section: "headers",
    status: "Analyzing HTTP headers",
    description:
      "Get HTTP response headers for a domain including security headers, caching headers, and server information. Use this tool when users ask about security headers, server software, caching, or HTTP configuration.",
  },
  {
    name: "get_seo",
    section: "seo",
    status: "Fetching SEO metadata",
    description:
      "Get SEO metadata for a domain including title, description, Open Graph tags, Twitter cards, and robots.txt rules. Use this tool when users ask about SEO, meta tags, social sharing, or how a site appears in search.",
  },
] as const;

export type DomainToolName = (typeof DOMAIN_TOOL_DEFS)[number]["name"];
export type DomainToolSection = (typeof DOMAIN_TOOL_DEFS)[number]["section"];

export type DomainToolResult<S extends DomainToolSection> =
  | Extract<LookupResult<S>, { success: true }>["data"]
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
  return DOMAIN_TOOL_STATUS[toolName as DomainToolName] ?? toolName;
}

/** Messages returned to the model when a tool call completes without data. */
export const INVALID_DOMAIN_MESSAGE = "Please provide a valid root domain (e.g., example.com).";
export const RATE_LIMIT_MESSAGE = "Rate limit exceeded. Please wait a moment and try again.";
export const TOOL_TIMEOUT_MESSAGE = "The lookup timed out. Try again in a moment.";

/** Message for a failed tRPC call from the browser chat's client tools. */
export function getDomainToolErrorMessage(err: unknown): string {
  const code = getTrpcErrorCode(err);
  if (code === "TOO_MANY_REQUESTS") {
    return RATE_LIMIT_MESSAGE;
  }
  if (code === "BAD_REQUEST") {
    return INVALID_DOMAIN_MESSAGE;
  }
  return getLookupErrorMessage("fetch_failed");
}

export function createDomainToolsContext<T>(context: T): Record<DomainToolName, T> {
  return Object.fromEntries(DOMAIN_TOOL_DEFS.map((def) => [def.name, context])) as Record<
    DomainToolName,
    T
  >;
}
