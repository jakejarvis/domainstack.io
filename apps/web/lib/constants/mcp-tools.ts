import type { Section } from "@domainstack/constants";

/**
 * The MCP server's one-tool-per-section lookups, keyed by section so a new
 * section can't be added without an MCP tool. Shared by the MCP route (which
 * registers them) and the MCP docs page (which lists them).
 */
export const MCP_SECTION_TOOLS = {
  registration: {
    name: "domain_registration",
    title: "Registration",
    description:
      "Get WHOIS/RDAP registration data for a domain including registrar, creation date, expiration date, nameservers, and registrant information",
  },
  hosting: {
    name: "domain_hosting",
    title: "Hosting",
    description:
      "Detect hosting, DNS, CDN, and email providers for a domain by analyzing DNS records and HTTP headers",
  },
  dns: {
    name: "domain_dns",
    title: "DNS Records",
    description: "Get DNS records for a domain including A, AAAA, MX, TXT, and NS records",
  },
  certificates: {
    name: "domain_certificates",
    title: "Certificates",
    description:
      "Get SSL/TLS certificate information for a domain including issuer, validity dates, and certificate chain",
  },
  headers: {
    name: "domain_headers",
    title: "Headers",
    description:
      "Get HTTP response headers for a domain including security headers, caching headers, and server information",
  },
  seo: {
    name: "domain_seo",
    title: "SEO",
    description:
      "Get SEO metadata for a domain including title, description, Open Graph tags, Twitter cards, and robots.txt rules",
  },
} as const satisfies Record<Section, { name: string; title: string; description: string }>;
