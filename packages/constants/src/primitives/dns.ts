/**
 * DNS constants and derived types.
 */

/**
 * Central list of DNS record types that we probe and display.
 */
export const DNS_RECORD_TYPES = ["A", "AAAA", "MX", "TXT", "NS"] as const;

/**
 * DNS-over-HTTPS providers for DNS resolution.
 * Used by safe-fetch for SSRF protection and by the web app for DNS lookups.
 */
export const DOH_PROVIDERS = [
  { key: "cloudflare", url: "https://cloudflare-dns.com/dns-query" },
  { key: "google", url: "https://dns.google/resolve" },
] as const;

/**
 * DNS record type numbers (RFC 1035 and extensions).
 * Maps record type names to their wire format type codes.
 */
export const DNS_TYPE_NUMBERS = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  DS: 43,
  RRSIG: 46,
  DNSKEY: 48,
} as const;

/**
 * DNSSEC validation outcome for a domain.
 * - secure: a validating resolver authenticated the answer (AD bit set)
 * - insecure: the answer resolved but there is no chain of trust (not signed)
 * - bogus: signed, but validation fails (resolves only with checking disabled)
 * - indeterminate: could not be determined (resolver failures)
 */
export const DNSSEC_STATUSES = ["secure", "insecure", "bogus", "indeterminate"] as const;
