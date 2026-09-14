/**
 * Cloudflare IP detection utilities.
 *
 * Checks if an IP address belongs to Cloudflare's network.
 */

import * as ipaddr from "ipaddr.js";
import { LRUCache } from "lru-cache";

/**
 * Cloudflare IP Ranges URL.
 * @see https://developers.cloudflare.com/api/resources/ips/methods/list/
 */
const CLOUDFLARE_IPS_URL = "https://api.cloudflare.com/client/v4/ips";

/**
 * LRU cache for Cloudflare IP check results.
 * Same IPs are checked repeatedly across different domains.
 *
 * Only populated while the range list is known, so an upstream outage cannot
 * persist a false negative.
 */
const cache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 800_000, // 800 seconds
});

export interface CloudflareIpRanges {
  ipv4Cidrs: string[];
  ipv6Cidrs: string[];
}

interface ParsedCloudflareRanges {
  ipv4: [ipaddr.IPv4, number][];
  ipv6: [ipaddr.IPv6, number][];
}

// Cache Cloudflare IP ranges in memory (refreshed weekly)
let parsedRanges: ParsedCloudflareRanges | null = null;
let loadedAt = 0;
let lastFailureAt = 0;
let activePromise: Promise<ParsedCloudflareRanges | null> | null = null;
const CACHE_TTL_MS = 604_800_000; // 1 week
const ERROR_BACKOFF_MS = 60_000; // 1 minute backoff on errors

/**
 * Parse CIDR strings into ipaddr.js objects for efficient matching.
 */
function parseCidrs(ranges: CloudflareIpRanges): ParsedCloudflareRanges {
  const ipv4: [ipaddr.IPv4, number][] = [];
  const ipv6: [ipaddr.IPv6, number][] = [];

  for (const cidr of ranges.ipv4Cidrs) {
    try {
      const [net, prefix] = ipaddr.parseCIDR(cidr);
      if (net.kind() === "ipv4") {
        ipv4.push([net as ipaddr.IPv4, prefix]);
      }
    } catch {
      // Skip invalid CIDRs
    }
  }

  for (const cidr of ranges.ipv6Cidrs) {
    try {
      const [net, prefix] = ipaddr.parseCIDR(cidr);
      if (net.kind() === "ipv6") {
        ipv6.push([net as ipaddr.IPv6, prefix]);
      }
    } catch {
      // Skip invalid CIDRs
    }
  }

  return { ipv4, ipv6 };
}

function toCidrArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/**
 * Fetch and parse the Cloudflare ranges.
 *
 * Throws when the response is unusable so a malformed payload is retried
 * after the error backoff instead of being cached for a week.
 */
async function fetchParsedRanges(): Promise<ParsedCloudflareRanges> {
  const res = await fetch(CLOUDFLARE_IPS_URL, {
    headers: process.env.EXTERNAL_USER_AGENT
      ? { "User-Agent": process.env.EXTERNAL_USER_AGENT }
      : undefined,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Cloudflare IPs: ${res.status}`);
  }

  const data = (await res.json()) as { result?: { ipv4_cidrs?: unknown; ipv6_cidrs?: unknown } };
  const parsed = parseCidrs({
    ipv4Cidrs: toCidrArray(data?.result?.ipv4_cidrs),
    ipv6Cidrs: toCidrArray(data?.result?.ipv6_cidrs),
  });

  if (parsed.ipv4.length === 0 && parsed.ipv6.length === 0) {
    throw new Error("Cloudflare IP response contained no usable CIDRs");
  }

  return parsed;
}

/**
 * Get parsed Cloudflare IP ranges with request coalescing and error backoff.
 *
 * Returns null when the ranges have never loaded successfully, so callers can
 * tell "not a Cloudflare IP" apart from "ranges unavailable".
 */
async function getParsedRanges(): Promise<ParsedCloudflareRanges | null> {
  const now = Date.now();

  // Return cached ranges if still fresh
  if (parsedRanges !== null && now - loadedAt < CACHE_TTL_MS) {
    return parsedRanges;
  }

  // Respect error backoff, including on cold start, to prevent request storms
  // when the upstream service is down. Serves stale ranges when we have them.
  if (now - lastFailureAt < ERROR_BACKOFF_MS) {
    return parsedRanges;
  }

  // Request coalescing: return active promise if one is in progress
  if (activePromise !== null) {
    return activePromise;
  }

  activePromise = (async () => {
    try {
      parsedRanges = await fetchParsedRanges();
      loadedAt = Date.now();
      lastFailureAt = 0;
      return parsedRanges;
    } catch {
      lastFailureAt = Date.now();
      // Keep serving stale ranges if we have them, otherwise signal "unknown"
      return parsedRanges;
    } finally {
      activePromise = null;
    }
  })();

  return activePromise;
}

/**
 * Check if a given IP address is part of Cloudflare's IP ranges.
 *
 * Returns false when the range list is unavailable, without caching that
 * result.
 */
export async function isCloudflareIp(ip: string): Promise<boolean> {
  const cached = cache.get(ip);
  if (cached !== undefined) {
    return cached;
  }

  const ranges = await getParsedRanges();
  if (!ranges) {
    return false;
  }

  let result = false;

  if (ipaddr.IPv4.isValid(ip)) {
    const parsed = ipaddr.IPv4.parse(ip);
    result = ranges.ipv4.some(([net, prefix]) => parsed.match([net, prefix]));
  } else if (ipaddr.IPv6.isValid(ip)) {
    const parsed = ipaddr.IPv6.parse(ip);
    result = ranges.ipv6.some(([net, prefix]) => parsed.match([net, prefix]));
  }

  cache.set(ip, result);
  return result;
}
