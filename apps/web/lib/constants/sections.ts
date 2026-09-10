import {
  IconCertificate,
  IconCloudComputing,
  IconIdBadge2,
  IconList,
  IconRoute,
  IconShare,
} from "@tabler/icons-react";

/**
 * Section types and metadata for domain report UI.
 */

/**
 * Every report section, in the order the report renders them. The `Section`
 * union and the `sections` record below both derive from this, so anything that
 * needs the full list at runtime can import it instead of retyping it.
 */
export const SECTION_IDS = [
  "registration",
  "hosting",
  "dns",
  "certificates",
  "headers",
  "seo",
] as const;

export type Section = (typeof SECTION_IDS)[number];

export type SectionAccent = "blue" | "purple" | "green" | "orange" | "pink" | "cyan";

export interface SectionDef {
  title: string;
  accent: SectionAccent;
  icon: React.ElementType;
  description: string;
  help: string;
  slug: string;
}

export const sections: Record<Section, SectionDef> = {
  registration: {
    title: "Registration",
    accent: "purple",
    icon: IconIdBadge2,
    description: "Registrar and registrant details",
    help: "RDAP/WHOIS shows registrar, registration dates, and registrant details.",
    slug: "registration",
  },
  hosting: {
    title: "Hosting & Email",
    accent: "blue",
    icon: IconCloudComputing,
    description: "Providers and IP geolocation",
    help: "Hosting provider serves a site; email provider handles a domain's email.",
    slug: "hosting",
  },
  dns: {
    title: "DNS Records",
    accent: "green",
    icon: IconRoute,
    description: "A, AAAA, MX, CNAME, TXT, NS",
    help: "DNS records map the domain to services like web (A/AAAA), mail (MX), and aliases (CNAME).",
    slug: "dns",
  },
  certificates: {
    title: "SSL Certificates",
    accent: "orange",
    icon: IconCertificate,
    description: "Issuer and validity",
    help: "SSL/TLS certificates encrypt traffic and verify a domain's identity.",
    slug: "certificates",
  },
  headers: {
    title: "HTTP Headers",
    accent: "pink",
    icon: IconList,
    description: "Server, security, caching",
    help: "Headers include server info and security/caching directives returned by a site.",
    slug: "headers",
  },
  seo: {
    title: "SEO & Social",
    accent: "cyan",
    icon: IconShare,
    description: "Meta tags, previews, robots.txt",
    help: "Open Graph, Twitter, and standard meta inform social previews and search engines.",
    slug: "seo",
  },
} as const;
