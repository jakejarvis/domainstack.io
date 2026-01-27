/**
 * DNS constants and derived types.
 */

/**
 * Central list of DNS record types that we probe and display.
 */
export const DNS_RECORD_TYPES = ["A", "AAAA", "MX", "TXT", "NS"] as const;

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

/**
 * DNS-over-HTTPS providers for DNS resolution.
 * Used by safe-fetch for SSRF protection and by the web app for DNS lookups.
 */
export const DOH_PROVIDERS = [
  { key: "cloudflare", url: "https://cloudflare-dns.com/dns-query" },
  { key: "google", url: "https://dns.google/resolve" },
] as const;

export type DohProvider = (typeof DOH_PROVIDERS)[number];

/**
 * DNS record type numbers (RFC 1035 and extensions).
 * Maps record type names to their wire format type codes.
 */
export const DNS_TYPE_NUMBERS = {
  A: 1,
  NS: 2,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  AAAA: 28,
} as const;
