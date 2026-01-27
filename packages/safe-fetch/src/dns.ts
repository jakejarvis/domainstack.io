import {
  DNS_TYPE_NUMBERS,
  DOH_PROVIDERS,
  type DohProvider,
} from "@domainstack/constants";
import { simpleHash } from "@domainstack/utils";
import { withRetry, withTimeout } from "./utils";

/**
 * DNS answer from DoH JSON response.
 */
interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

/**
 * DoH JSON response (RFC 8427).
 */
interface DnsJson {
  Status: number;
  Answer?: DnsAnswer[];
}

/**
 * A resolved IP address with family (IPv4 or IPv6).
 */
export interface ResolvedIp {
  address: string;
  family: 4 | 6;
}

/**
 * Get provider order based on domain hash (for cache consistency).
 */
function providerOrder(domain: string): DohProvider[] {
  const hash = simpleHash(domain.toLowerCase());
  const start = hash % DOH_PROVIDERS.length;
  return [...DOH_PROVIDERS.slice(start), ...DOH_PROVIDERS.slice(0, start)];
}

/**
 * Query a DoH provider for A/AAAA records.
 */
async function queryProvider(
  provider: DohProvider,
  domain: string,
  type: "A" | "AAAA",
  userAgent: string,
  timeoutMs: number,
): Promise<DnsAnswer[]> {
  const url = new URL(provider.url);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);

  const res = await withTimeout(
    (signal) =>
      fetch(url, {
        headers: {
          Accept: "application/dns-json",
          "User-Agent": userAgent,
        },
        signal,
      }),
    timeoutMs,
  );

  if (!res.ok) {
    throw new Error(`DoH query failed: ${provider.key} ${res.status}`);
  }

  const json = (await res.json()) as DnsJson;

  // NXDOMAIN or no answers
  if (json.Status !== 0 || !json.Answer || !Array.isArray(json.Answer)) {
    return [];
  }

  return json.Answer;
}

/**
 * Options for resolveHostIps.
 */
export interface ResolveHostIpsOptions {
  /** User-Agent header (required) */
  userAgent: string;
  /** Return all addresses instead of just the first */
  all?: boolean;
  /** Timeout per request in ms (default: 2000) */
  timeoutMs?: number;
  /** Number of retries per provider (default: 1) */
  retries?: number;
}

/**
 * Resolve a hostname to IP addresses using DNS-over-HTTPS.
 *
 * Used internally by safeFetch for SSRF protection - resolves A/AAAA records
 * to validate that the target host doesn't resolve to private IP ranges.
 *
 * Uses DoH to avoid blocking Node.js's limited threadpool.
 *
 * @throws Error if all providers fail
 */
export async function resolveHostIps(
  hostname: string,
  options: ResolveHostIpsOptions,
): Promise<ResolvedIp | ResolvedIp[]> {
  const { userAgent, all = false, timeoutMs = 2000, retries = 1 } = options;
  const providers = providerOrder(hostname);
  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      const queryWithRetry = () =>
        withRetry(
          async () => {
            const [aResults, aaaaResults] = await Promise.allSettled([
              queryProvider(provider, hostname, "A", userAgent, timeoutMs),
              queryProvider(provider, hostname, "AAAA", userAgent, timeoutMs),
            ]);

            const records: ResolvedIp[] = [];

            if (aResults.status === "fulfilled") {
              for (const answer of aResults.value) {
                if (answer.type === DNS_TYPE_NUMBERS.A && answer.data) {
                  records.push({ address: answer.data.trim(), family: 4 });
                }
              }
            }

            if (aaaaResults.status === "fulfilled") {
              for (const answer of aaaaResults.value) {
                if (answer.type === DNS_TYPE_NUMBERS.AAAA && answer.data) {
                  records.push({ address: answer.data.trim(), family: 6 });
                }
              }
            }

            if (records.length === 0) {
              throw new Error("No DNS records found");
            }

            return records;
          },
          { retries },
        );

      const records = await queryWithRetry();
      return all ? records : records[0];
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("DNS lookup failed");
}

/**
 * Check if an error is an expected DNS failure (NXDOMAIN, etc).
 */
export function isExpectedDnsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  // Check for ENOTFOUND code on error or its cause
  const errorWithCode = err as Error & {
    code?: string;
    cause?: { code?: string };
  };
  if (errorWithCode.code === "ENOTFOUND") return true;
  if (errorWithCode.cause?.code === "ENOTFOUND") return true;

  const message = err.message.toLowerCase();
  return (
    message.includes("enotfound") ||
    message.includes("getaddrinfo") ||
    message.includes("dns lookup failed") ||
    message.includes("no dns records found")
  );
}
