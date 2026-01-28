/**
 * Default provider catalog.
 *
 * Contains minimal placeholder providers for each category.
 * In production, you'll want to load a full catalog from your own source.
 */

import type { ProviderCatalog } from "./parser";

/**
 * Default provider catalog with common providers.
 *
 * This is a minimal set of providers for basic functionality.
 * Production systems should use a more comprehensive catalog.
 */
export const DEFAULT_CATALOG: ProviderCatalog = {
  ca: [
    {
      name: "Let's Encrypt",
      domain: "letsencrypt.org",
      rule: {
        any: [
          { kind: "issuerIncludes", substr: "let's encrypt" },
          { kind: "issuerIncludes", substr: "lets encrypt" },
          { kind: "issuerIncludes", substr: "isrg" },
          { kind: "issuerEquals", value: "r3" },
          { kind: "issuerEquals", value: "r10" },
          { kind: "issuerEquals", value: "r11" },
          { kind: "issuerEquals", value: "e1" },
          { kind: "issuerEquals", value: "e5" },
          { kind: "issuerEquals", value: "e6" },
        ],
      },
    },
    {
      name: "DigiCert",
      domain: "digicert.com",
      rule: { kind: "issuerIncludes", substr: "digicert" },
    },
    {
      name: "Sectigo",
      domain: "sectigo.com",
      rule: {
        any: [
          { kind: "issuerIncludes", substr: "sectigo" },
          { kind: "issuerIncludes", substr: "comodo" },
        ],
      },
    },
    {
      name: "GlobalSign",
      domain: "globalsign.com",
      rule: { kind: "issuerIncludes", substr: "globalsign" },
    },
    {
      name: "GoDaddy",
      domain: "godaddy.com",
      rule: {
        any: [
          { kind: "issuerIncludes", substr: "godaddy" },
          { kind: "issuerIncludes", substr: "go daddy" },
          { kind: "issuerIncludes", substr: "starfield" },
        ],
      },
    },
  ],
  dns: [
    {
      name: "Cloudflare",
      domain: "cloudflare.com",
      rule: { kind: "nsSuffix", suffix: "cloudflare.com" },
    },
    {
      name: "Amazon Route 53",
      domain: "aws.amazon.com",
      rule: {
        any: [
          {
            kind: "nsRegex",
            pattern: "^ns-\\d+\\.awsdns-\\d+\\.(com|net|org|co\\.uk)$",
            flags: "i",
          },
          {
            kind: "nsRegex",
            pattern: "^ns\\d+\\.amzndns\\.(com|net|org|co\\.uk)$",
            flags: "i",
          },
        ],
      },
    },
    {
      name: "Google Cloud DNS",
      domain: "cloud.google.com",
      rule: { kind: "nsSuffix", suffix: "googledomains.com" },
    },
    {
      name: "Vercel",
      domain: "vercel.com",
      rule: { kind: "nsSuffix", suffix: "vercel-dns.com" },
    },
    {
      name: "DNSimple",
      domain: "dnsimple.com",
      rule: { kind: "nsSuffix", suffix: "dnsimple.com" },
    },
  ],
  email: [
    {
      name: "Google Workspace",
      domain: "google.com",
      rule: {
        any: [
          { kind: "mxSuffix", suffix: "smtp.google.com" },
          { kind: "mxSuffix", suffix: "aspmx.l.google.com" },
          { kind: "mxSuffix", suffix: "googlemail.com" },
          { kind: "mxRegex", pattern: "^alt\\d+\\.aspmx\\.l\\.google\\.com$" },
          {
            kind: "mxRegex",
            pattern: "^aspmx\\d*\\.googlemail\\.com$",
            flags: "i",
          },
        ],
      },
    },
    {
      name: "Microsoft 365",
      domain: "microsoft.com",
      rule: {
        any: [
          { kind: "mxSuffix", suffix: "mail.protection.outlook.com" },
          { kind: "mxSuffix", suffix: "outlook.com" },
        ],
      },
    },
    {
      name: "Fastmail",
      domain: "fastmail.com",
      rule: {
        any: [
          { kind: "mxSuffix", suffix: "fastmail.com" },
          { kind: "mxSuffix", suffix: "messagingengine.com" },
        ],
      },
    },
    {
      name: "Proton Mail",
      domain: "proton.me",
      rule: {
        any: [
          { kind: "mxSuffix", suffix: "protonmail.ch" },
          { kind: "mxSuffix", suffix: "proton.me" },
        ],
      },
    },
    {
      name: "Zoho Mail",
      domain: "zoho.com",
      rule: { kind: "mxSuffix", suffix: "zoho.com" },
    },
  ],
  hosting: [
    {
      name: "Vercel",
      domain: "vercel.com",
      rule: {
        any: [
          { kind: "headerEquals", name: "server", value: "vercel" },
          { kind: "headerPresent", name: "x-vercel-id" },
        ],
      },
    },
    {
      name: "Cloudflare",
      domain: "cloudflare.com",
      rule: {
        any: [
          { kind: "headerEquals", name: "server", value: "cloudflare" },
          { kind: "headerPresent", name: "cf-ray" },
        ],
      },
    },
    {
      name: "Netlify",
      domain: "netlify.com",
      rule: {
        any: [
          { kind: "headerEquals", name: "server", value: "netlify" },
          { kind: "headerPresent", name: "x-nf-request-id" },
        ],
      },
    },
    {
      name: "AWS CloudFront",
      domain: "aws.amazon.com",
      rule: {
        any: [
          { kind: "headerEquals", name: "server", value: "cloudfront" },
          { kind: "headerPresent", name: "x-amz-cf-id" },
          { kind: "headerPresent", name: "x-amz-cf-pop" },
        ],
      },
    },
    {
      name: "Fastly",
      domain: "fastly.com",
      rule: {
        any: [
          { kind: "headerPresent", name: "x-served-by" },
          { kind: "headerPresent", name: "x-fastly-request-id" },
        ],
      },
    },
  ],
  registrar: [
    {
      name: "GoDaddy",
      domain: "godaddy.com",
      rule: {
        any: [
          { kind: "registrarIncludes", substr: "godaddy" },
          { kind: "registrarIncludes", substr: "go daddy" },
          { kind: "registrarIncludes", substr: "wild west domains" },
        ],
      },
    },
    {
      name: "Namecheap",
      domain: "namecheap.com",
      rule: { kind: "registrarIncludes", substr: "namecheap" },
    },
    {
      name: "Cloudflare Registrar",
      domain: "cloudflare.com",
      rule: { kind: "registrarIncludes", substr: "cloudflare" },
    },
    {
      name: "Google Domains",
      domain: "domains.google",
      rule: {
        any: [
          { kind: "registrarIncludes", substr: "google domains" },
          { kind: "registrarIncludes", substr: "google llc" },
        ],
      },
    },
    {
      name: "Amazon Registrar",
      domain: "aws.amazon.com",
      rule: {
        any: [
          { kind: "registrarIncludes", substr: "amazon registrar" },
          { kind: "registrarIncludes", substr: "amazon.com" },
        ],
      },
    },
  ],
};

/**
 * Get the default provider catalog.
 */
export function getDefaultCatalog(): ProviderCatalog {
  return DEFAULT_CATALOG;
}
