import { z } from "zod";

import { SECTION_IDS, type Section } from "@domainstack/constants";

const domainSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .describe("Domain name to look up, e.g. example.com"),
});

const reportSchema = domainSchema.extend({
  sections: z
    .array(z.enum(SECTION_IDS))
    .optional()
    .describe("Sections to include in the report. If omitted, all sections are included."),
});

export { domainSchema, reportSchema };

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
    whenToUse: "who registered a domain, which registrar, when it was created or expires",
  },
  hosting: {
    name: "domain_hosting",
    title: "Hosting",
    description:
      "Detect hosting, DNS, CDN, and email providers for a domain by analyzing DNS records and HTTP headers",
    whenToUse: "where a site is hosted and which CDN, DNS, or email provider it uses",
  },
  dns: {
    name: "domain_dns",
    title: "DNS Records",
    description:
      "Get DNS records for a domain including A, AAAA, MX, TXT, and NS records, plus DNSSEC status",
    whenToUse: "A, AAAA, MX, TXT, and NS records, and DNSSEC status",
  },
  certificates: {
    name: "domain_certificates",
    title: "Certificates",
    description:
      "Get SSL/TLS certificate information for a domain including issuer, validity dates, and certificate chain",
    whenToUse: "an SSL/TLS certificate's issuer, validity dates, and chain",
  },
  headers: {
    name: "domain_headers",
    title: "Headers",
    description:
      "Get HTTP response headers for a domain including security headers, caching headers, and server information",
    whenToUse: "HTTP response headers, including security and caching headers",
  },
  seo: {
    name: "domain_seo",
    title: "SEO",
    description:
      "Get SEO metadata for a domain including title, description, Open Graph tags, Twitter cards, and robots.txt rules",
    whenToUse: "title, meta description, Open Graph and Twitter tags, and robots.txt rules",
  },
} as const satisfies Record<
  Section,
  { name: string; title: string; description: string; whenToUse: string }
>;

export const MCP_REPORT_TOOL = {
  name: "domain_report",
  title: "Full Report",
  description:
    "Get a comprehensive domain report combining registration, DNS, hosting, certificates, headers, and SEO data in a single call. Use the sections parameter to request only specific data.",
} as const;

export const MCP_TOOLS = [
  ...SECTION_IDS.map((section) => ({
    name: MCP_SECTION_TOOLS[section].name,
    title: MCP_SECTION_TOOLS[section].title,
    description: MCP_SECTION_TOOLS[section].description,
    inputSchema: domainSchema,
  })),
  { ...MCP_REPORT_TOOL, inputSchema: reportSchema },
];
