import { z } from "zod";

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

export function getDomainToolStatus(type: string): string {
  const toolName = type.replace(/^tool-/, "");
  return DOMAIN_TOOL_STATUS[toolName as DomainToolName] ?? toolName;
}

export function getDomainToolErrorMessage(err: unknown, domain: string): string {
  const rawMessage = err instanceof Error ? err.message : "Unknown error";
  const lowerMessage = rawMessage.toLowerCase();

  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return "Request timed out. The domain may be slow to respond.";
  }
  if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
    return "Rate limit exceeded. Please wait a moment and try again.";
  }
  if (
    lowerMessage.includes("not found") ||
    lowerMessage.includes("enotfound") ||
    lowerMessage.includes("dns")
  ) {
    return `Could not resolve ${domain}. The domain may not exist or DNS may be misconfigured.`;
  }
  if (
    lowerMessage.includes("certificate") ||
    lowerMessage.includes("ssl") ||
    lowerMessage.includes("tls")
  ) {
    return `Could not establish secure connection to ${domain}.`;
  }
  if (lowerMessage.includes("refused") || lowerMessage.includes("unreachable")) {
    return `Could not connect to ${domain}. The server may be down.`;
  }
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("401")) {
    return "Authentication required. Please sign in and try again.";
  }

  return "Unable to fetch data. Please try again.";
}

export function createDomainToolsContext<T>(context: T): Record<DomainToolName, T> {
  return Object.fromEntries(DOMAIN_TOOL_DEFS.map((def) => [def.name, context])) as Record<
    DomainToolName,
    T
  >;
}
