import {
  Globe,
  HardDrive,
  List,
  Share2,
  ShieldCheck,
  User,
} from "lucide-react";

export type SectionAccent =
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "pink"
  | "cyan";

export const SECTION_DEFS = {
  registration: {
    title: "Registration",
    accent: "purple" as SectionAccent,
    Icon: User,
    description: "Registrar and registrant details",
    help: "RDAP/WHOIS shows registrar, registration dates, and registrant details.",
  },
  hosting: {
    title: "Hosting & Email",
    accent: "blue" as SectionAccent,
    Icon: HardDrive,
    description: "Providers and IP geolocation",
    help: "Hosting provider serves a site; email provider handles a domain's email.",
  },
  dns: {
    title: "DNS Records",
    accent: "green" as SectionAccent,
    Icon: Globe,
    description: "A, AAAA, MX, CNAME, TXT, NS",
    help: "DNS records map the domain to services like web (A/AAAA), mail (MX), and aliases (CNAME).",
  },
  certificates: {
    title: "SSL Certificates",
    accent: "orange" as SectionAccent,
    Icon: ShieldCheck,
    description: "Issuer and validity",
    help: "SSL/TLS certificates encrypt traffic and verify a domain's identity.",
  },
  headers: {
    title: "HTTP Headers",
    accent: "pink" as SectionAccent,
    Icon: List,
    description: "Server, security, caching",
    help: "Headers include server info and security/caching directives returned by a site.",
  },
  seo: {
    title: "SEO & Social",
    accent: "cyan" as SectionAccent,
    Icon: Share2,
    description: "Meta tags, previews, robots.txt",
    help: "Open Graph, Twitter, and standard meta inform social previews and search engines.",
  },
} as const;

export type SectionKey = keyof typeof SECTION_DEFS;

// Single source of truth for section ordering across loading and fallback UIs
export const SECTION_ORDER: readonly SectionKey[] = [
  "registration",
  "hosting",
  "dns",
  "certificates",
  "headers",
] as const;
