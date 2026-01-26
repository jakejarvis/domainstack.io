import { LRUCache } from "lru-cache";
import { toRegistrableDomain as toRegistrableDomainRdapper } from "rdapper";
import { BLACKLISTED_SUFFIXES } from "@/lib/constants/domain-validation";
import { normalizeDomainInput } from "@/lib/domain-utils";

/**
 * LRU cache for PSL lookups (cross-request).
 *
 * Same hostnames are normalized repeatedly across requests:
 * - Provider detection: ns1.cloudflare.com → cloudflare.com
 * - Email fallback: mx.google.com → google.com
 * - DNS fallback: ns1.digitalocean.com → digitalocean.com
 *
 * With Fluid Compute, this cache persists across requests in the same instance.
 *
 * Uses empty string as sentinel for "no result" since LRUCache doesn't accept null.
 */
const cache = new LRUCache<string, string>({
  max: 1000,
  ttl: 800_000, // 800 seconds (theoretical max duration of a fluid instance)
});

/** Sentinel value for "domain is invalid/blacklisted" */
const NO_RESULT = "";

/**
 * Convert a domain/URL input to its registrable domain (eTLD+1).
 *
 * Examples:
 * - "www.example.com" → "example.com"
 * - "https://blog.example.co.uk/path" → "example.co.uk"
 * - "ns1.cloudflare.com" → "cloudflare.com"
 *
 * LRU cache persists across requests in Fluid Compute.
 *
 * @param input - Domain name, hostname, or URL
 * @returns Registrable domain or null if invalid/blacklisted
 */
export function toRegistrableDomain(input: string): string | null {
  // First normalize the input to extract a clean hostname
  // This handles user input with schemes, paths, ports, auth, trailing dots, www., etc.
  const normalized = normalizeDomainInput(input);
  if (!normalized) return null;

  const value = normalized.trim().toLowerCase();
  if (value === "") return null;

  // Shortcut: exact suffixes such as ".css.map" that frequently appear
  for (const suffix of BLACKLISTED_SUFFIXES) {
    if (value.endsWith(suffix)) return null;
  }

  // Check LRU cache
  const cached = cache.get(value);
  if (cached !== undefined) {
    return cached === NO_RESULT ? null : cached;
  }

  // PSL lookup
  const result = toRegistrableDomainRdapper(value);

  // Cache the result (use sentinel for null)
  cache.set(value, result ?? NO_RESULT);

  return result;
}
