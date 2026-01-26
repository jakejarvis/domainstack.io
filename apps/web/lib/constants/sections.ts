import {
  IconCertificate,
  IconDeviceDesktop,
  IconIdBadge2,
  IconList,
  IconRoute,
  IconShare,
} from "@tabler/icons-react";

/**
 * Section types and metadata for domain report UI.
 */

export type Section =
  | "dns"
  | "headers"
  | "hosting"
  | "certificates"
  | "seo"
  | "registration";

export type SectionAccent =
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "pink"
  | "cyan";

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
    accent: "purple" as SectionAccent,
    icon: IconIdBadge2,
    description: "Registrar and registrant details",
    help: "RDAP/WHOIS shows registrar, registration dates, and registrant details.",
    slug: "registration",
  },
  hosting: {
    title: "Hosting & Email",
    accent: "blue" as SectionAccent,
    icon: IconDeviceDesktop,
    description: "Providers and IP geolocation",
    help: "Hosting provider serves a site; email provider handles a domain's email.",
    slug: "hosting",
  },
  dns: {
    title: "DNS Records",
    accent: "green" as SectionAccent,
    icon: IconRoute,
    description: "A, AAAA, MX, CNAME, TXT, NS",
    help: "DNS records map the domain to services like web (A/AAAA), mail (MX), and aliases (CNAME).",
    slug: "dns",
  },
  certificates: {
    title: "SSL Certificates",
    accent: "orange" as SectionAccent,
    icon: IconCertificate,
    description: "Issuer and validity",
    help: "SSL/TLS certificates encrypt traffic and verify a domain's identity.",
    slug: "certificates",
  },
  headers: {
    title: "HTTP Headers",
    accent: "pink" as SectionAccent,
    icon: IconList,
    description: "Server, security, caching",
    help: "Headers include server info and security/caching directives returned by a site.",
    slug: "headers",
  },
  seo: {
    title: "SEO & Social",
    accent: "cyan" as SectionAccent,
    icon: IconShare,
    description: "Meta tags, previews, robots.txt",
    help: "Open Graph, Twitter, and standard meta inform social previews and search engines.",
    slug: "seo",
  },
} as const;
