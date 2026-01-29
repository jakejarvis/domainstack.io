/**
 * Client-side domain lookup tools for browser-based AI chat.
 *
 * These tools mirror the server-side tools in workflows/chat/tools.ts
 * but call tRPC procedures directly from the browser instead of using
 * durable workflow steps.
 */

import type { TRPCClient } from "@trpc/client";
import { tool } from "ai";
import { z } from "zod";
import type { AppRouter } from "@/server/routers/_app";

/**
 * Schema for domain tool inputs.
 * Using .describe() to help LLMs understand the expected format.
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
 * Map specific error patterns to user-friendly messages.
 */
function getUserFriendlyError(err: unknown, domain: string): string {
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
  if (
    lowerMessage.includes("refused") ||
    lowerMessage.includes("unreachable")
  ) {
    return `Could not connect to ${domain}. The server may be down.`;
  }
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("401")) {
    return "Authentication required. Please sign in and try again.";
  }

  return "Unable to fetch data. Please try again.";
}

type TRPCClientType = TRPCClient<AppRouter>;

/**
 * Creates client-side domain intelligence tools that call tRPC procedures.
 *
 * Unlike the server-side tools, these execute directly in the browser
 * without durable workflow steps. Rate limiting and caching are still
 * handled by the tRPC procedures on the server.
 *
 * @param trpc - The tRPC client instance from useTRPCClient
 */
export function createClientDomainTools(trpc: TRPCClientType) {
  return {
    get_registration: tool({
      description:
        "Get WHOIS/RDAP registration data for a domain including registrar, creation date, expiration date, nameservers, and registrant information. Use this tool when users ask about domain ownership, registration, expiry, or who owns a domain.",
      inputSchema: domainSchema,
      execute: async ({ domain }: { domain: string }) => {
        try {
          const result = await trpc.domain.getRegistration.query({ domain });
          if (!result.success) {
            return { error: result.error };
          }
          return result.data;
        } catch (err) {
          return { error: getUserFriendlyError(err, domain) };
        }
      },
    }),

    get_dns_records: tool({
      description:
        "Get DNS records for a domain including A, AAAA, CNAME, MX, TXT, NS, and SOA records. Use this tool when users ask about DNS configuration, IP addresses, mail servers, or nameservers.",
      inputSchema: domainSchema,
      execute: async ({ domain }: { domain: string }) => {
        try {
          const result = await trpc.domain.getDnsRecords.query({ domain });
          if (!result.success) {
            return { error: result.error };
          }
          return result.data;
        } catch (err) {
          return { error: getUserFriendlyError(err, domain) };
        }
      },
    }),

    get_hosting: tool({
      description:
        "Detect hosting, DNS, CDN, and email providers for a domain by analyzing DNS records and HTTP headers. Use this tool when users ask where a site is hosted, what CDN they use, or who provides their email.",
      inputSchema: domainSchema,
      execute: async ({ domain }: { domain: string }) => {
        try {
          const result = await trpc.domain.getHosting.query({ domain });
          if (!result.success) {
            return { error: result.error };
          }
          return result.data;
        } catch (err) {
          return { error: getUserFriendlyError(err, domain) };
        }
      },
    }),

    get_certificates: tool({
      description:
        "Get SSL/TLS certificate information for a domain including issuer, validity dates, and certificate chain. Use this tool when users ask about HTTPS, SSL certificates, security, or certificate expiry.",
      inputSchema: domainSchema,
      execute: async ({ domain }: { domain: string }) => {
        try {
          const result = await trpc.domain.getCertificates.query({ domain });
          if (!result.success) {
            return { error: result.error };
          }
          return result.data;
        } catch (err) {
          return { error: getUserFriendlyError(err, domain) };
        }
      },
    }),

    get_headers: tool({
      description:
        "Get HTTP response headers for a domain including security headers, caching headers, and server information. Use this tool when users ask about security headers, server software, caching, or HTTP configuration.",
      inputSchema: domainSchema,
      execute: async ({ domain }: { domain: string }) => {
        try {
          const result = await trpc.domain.getHeaders.query({ domain });
          if (!result.success) {
            return { error: result.error };
          }
          return result.data;
        } catch (err) {
          return { error: getUserFriendlyError(err, domain) };
        }
      },
    }),

    get_seo: tool({
      description:
        "Get SEO metadata for a domain including title, description, Open Graph tags, Twitter cards, and robots.txt rules. Use this tool when users ask about SEO, meta tags, social sharing, or how a site appears in search.",
      inputSchema: domainSchema,
      execute: async ({ domain }: { domain: string }) => {
        try {
          const result = await trpc.domain.getSeo.query({ domain });
          if (!result.success) {
            return { error: result.error };
          }
          return result.data;
        } catch (err) {
          return { error: getUserFriendlyError(err, domain) };
        }
      },
    }),
  };
}

export type ClientDomainTools = ReturnType<typeof createClientDomainTools>;
