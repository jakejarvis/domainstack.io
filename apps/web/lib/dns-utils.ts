import type { DnsRecordType } from "@domainstack/constants";
import type { DnsRecord } from "@domainstack/types";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { simpleHash } from "@/lib/simple-hash";

// ============================================================================
// DNS Record Utilities
// ============================================================================

/**
 * Generate a unique key for a DNS record.
 * TXT records preserve case for values (e.g., verification tokens).
 * All other record types normalize values to lowercase.
 * Names (hostnames) are always normalized to lowercase per RFC 1035.
 */
export function makeDnsRecordKey(
  type: string,
  name: string,
  value: string,
  priority: number | null | undefined,
): string {
  const priorityPart = priority != null ? `|${priority}` : "";
  const normalizedName = name.trim().toLowerCase();
  // TXT values preserve case; all others normalize to lowercase
  const normalizedValue =
    type === "TXT" ? value.trim() : value.trim().toLowerCase();
  return `${type}|${normalizedName}|${normalizedValue}${priorityPart}`;
}

/**
 * Deduplicate DNS records.
 * Uses case-sensitive comparison for TXT values, case-insensitive for others.
 */
export function deduplicateDnsRecords(records: DnsRecord[]): DnsRecord[] {
  const seen = new Set<string>();
  const deduplicated: DnsRecord[] = [];

  for (const r of records) {
    const key = makeDnsRecordKey(r.type, r.name, r.value, r.priority);

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(r);
    }
  }

  return deduplicated;
}

/**
 * Deduplicate DNS records by value and priority only (for tooltip display).
 * Case-insensitive comparison for consistent deduplication.
 */
export function deduplicateDnsRecordsByValue(
  records: DnsRecord[],
): DnsRecord[] {
  const seen = new Set<string>();
  const deduplicated: DnsRecord[] = [];

  for (const r of records) {
    const key = `${r.value.trim().toLowerCase()}|${r.priority ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(r);
    }
  }

  return deduplicated;
}

/**
 * Sort DNS records for a specific type.
 * MX records are sorted by priority first, then alphabetically by value.
 * All other types are sorted alphabetically by value.
 */
export function sortDnsRecordsForType(
  records: DnsRecord[],
  type: DnsRecordType,
): DnsRecord[] {
  const sorted = [...records];

  if (type === "MX") {
    sorted.sort((a, b) => {
      const ap = a.priority ?? Number.MAX_SAFE_INTEGER;
      const bp = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.value.localeCompare(b.value);
    });
    return sorted;
  }

  sorted.sort((a, b) => a.value.localeCompare(b.value));
  return sorted;
}

/**
 * Sort DNS records by type order, then by type-specific sorting rules.
 * Used for consistent display ordering in API responses.
 */
export function sortDnsRecordsByType(
  records: DnsRecord[],
  order: readonly DnsRecordType[],
): DnsRecord[] {
  const byType: Record<DnsRecordType, DnsRecord[]> = {
    A: [],
    AAAA: [],
    MX: [],
    TXT: [],
    NS: [],
  };

  for (const r of records) {
    byType[r.type].push(r);
  }

  const sorted: DnsRecord[] = [];
  for (const t of order) {
    sorted.push(...sortDnsRecordsForType(byType[t], t));
  }

  return sorted;
}

// ============================================================================
// DNS-over-HTTPS (DoH) providers
// ============================================================================

export const DOH_PROVIDERS = [
  {
    key: "cloudflare",
    url: "https://cloudflare-dns.com/dns-query",
    headers: {},
  },
  {
    key: "google",
    url: "https://dns.google/resolve",
    headers: {},
  },
] as const;

export type DohProvider = (typeof DOH_PROVIDERS)[number];

/**
 * DNS record type numbers (RFC 1035 and extensions).
 */
export const DNS_TYPE_NUMBERS = {
  A: 1,
  NS: 2,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  AAAA: 28,
} as const;

/**
 * DNS answer from DoH JSON response.
 */
export interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

/**
 * DoH JSON response format (RFC 8427).
 */
export interface DnsJson {
  Status: number;
  Answer?: DnsAnswer[];
}

// ============================================================================
// Provider ordering and URL building
// ============================================================================

/**
 * Build a DoH query URL for a given provider, domain, and record type.
 */
function buildDohUrl(provider: DohProvider, domain: string, type: string): URL {
  const url = new URL(provider.url);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);
  return url;
}

/**
 * Deterministic provider ordering based on domain hash for cache consistency.
 * Ensures the same domain always tries providers in the same order across requests.
 */
export function providerOrderForLookup(domain: string): DohProvider[] {
  // Normalize to lowercase for case-insensitive DNS name matching (RFC 1035)
  const hash = simpleHash(domain.toLowerCase());
  const start = hash % DOH_PROVIDERS.length;
  return [
    ...DOH_PROVIDERS.slice(start),
    ...DOH_PROVIDERS.slice(0, start),
  ] as DohProvider[];
}

// ============================================================================
// Shared DoH query logic
// ============================================================================

export interface DohQueryOptions {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  /** Add timestamp parameter to bypass HTTP caches (useful for verification) */
  cacheBust?: boolean;
}

/**
 * Query a single record type from a DoH provider.
 * Returns parsed DNS answers or empty array if no records found.
 *
 * This is the shared primitive used by both:
 * - `lib/domain/dns-lookup.ts` for full DNS lookups
 * - `lib/resolver.ts` for SSRF protection IP resolution
 */
export async function queryDohProvider(
  provider: DohProvider,
  domain: string,
  type: string,
  options: DohQueryOptions = {},
): Promise<DnsAnswer[]> {
  const url = buildDohUrl(provider, domain, type);
  if (options.cacheBust) {
    url.searchParams.set("t", Date.now().toString());
  }
  const timeoutMs = options.timeoutMs ?? 2000;
  const retries = options.retries ?? 1;
  const backoffMs = options.backoffMs ?? 150;

  const res = await fetchWithTimeoutAndRetry(
    url,
    {
      headers: {
        Accept: "application/dns-json",
        ...provider.headers,
      },
    },
    { timeoutMs, retries, backoffMs },
  );

  if (!res.ok) {
    throw new Error(`DoH query failed: ${provider.key} ${type} ${res.status}`);
  }

  const json = (await res.json()) as DnsJson;

  // Validate JSON shape to prevent crashes on unexpected provider responses
  if (!json || typeof json !== "object") {
    throw new Error(`DoH invalid response: ${provider.key} (not an object)`);
  }

  // NXDOMAIN or no answers
  if (json.Status !== 0 || !json.Answer) {
    return [];
  }

  if (!Array.isArray(json.Answer)) {
    throw new Error(
      `DoH invalid response: ${provider.key} (Answer is not an array)`,
    );
  }

  return json.Answer;
}

/**
 * Filter DNS answers to only those matching the expected type number.
 * DoH providers often include CNAME records in answer chains.
 */
export function filterAnswersByType(
  answers: DnsAnswer[],
  expectedType: number,
): DnsAnswer[] {
  return answers.filter((a) => a.type === expectedType);
}

/**
 * Check if an error is an expected DNS resolution failure.
 * These occur when a domain has no A/AAAA records (i.e., no web hosting)
 * or simply does not exist.
 */
export function isExpectedDnsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  // Check for ENOTFOUND (getaddrinfo failure)
  const { cause } = err as Error & { cause?: Error };
  if (cause && "code" in cause && cause.code === "ENOTFOUND") {
    return true;
  }

  // Check for other DNS-related error codes
  const errorWithCode = err as Error & { code?: string };
  if (errorWithCode.code === "ENOTFOUND") {
    return true;
  }

  // Check error message patterns
  const message = err.message.toLowerCase();
  return (
    message.includes("enotfound") ||
    message.includes("getaddrinfo") ||
    message.includes("dns lookup failed")
  );
}
