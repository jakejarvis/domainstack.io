import type { Section } from "@domainstack/constants";

/**
 * The MCP server's one-tool-per-section lookups. Shared by the MCP route (which
 * registers them) and the MCP docs page (which lists them).
 */
export const MCP_SECTION_TOOLS = [
  {
    section: "registration",
    name: "domain_registration",
    title: "Registration",
    description:
      "Get WHOIS/RDAP registration data for a domain including registrar, creation date, expiration date, nameservers, and registrant information",
  },
  {
    section: "dns",
    name: "domain_dns",
    title: "DNS Records",
    description:
      "Get DNS records for a domain including A, AAAA, CNAME, MX, TXT, NS, and SOA records",
  },
  {
    section: "hosting",
    name: "domain_hosting",
    title: "Hosting",
    description:
      "Detect hosting, DNS, CDN, and email providers for a domain by analyzing DNS records and HTTP headers",
  },
  {
    section: "certificates",
    name: "domain_certificates",
    title: "Certificates",
    description:
      "Get SSL/TLS certificate information for a domain including issuer, validity dates, and certificate chain",
  },
  {
    section: "headers",
    name: "domain_headers",
    title: "Headers",
    description:
      "Get HTTP response headers for a domain including security headers, caching headers, and server information",
  },
  {
    section: "seo",
    name: "domain_seo",
    title: "SEO",
    description:
      "Get SEO metadata for a domain including title, description, Open Graph tags, Twitter cards, and robots.txt rules",
  },
] as const satisfies readonly {
  section: Section;
  name: string;
  title: string;
  description: string;
}[];
