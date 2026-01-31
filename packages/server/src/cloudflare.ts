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
let cachedRanges: CloudflareIpRanges | null = null;
let parsedRanges: ParsedCloudflareRanges | null = null;
let cachedAt = 0;
let activePromise: Promise<CloudflareIpRanges> | null = null;
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

/**
 * Fetch Cloudflare IP ranges with request coalescing and error backoff.
 */
async function getCloudflareIpRanges(): Promise<CloudflareIpRanges> {
  const now = Date.now();

  // Return cached ranges if still valid
  if (cachedRanges !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedRanges;
  }

  // Respect error backoff even on cold start (when cachedRanges is null)
  // This prevents request storms when the upstream service is down.
  // The error handler sets cachedAt to a synthetic timestamp that makes
  // (now - cachedAt < CACHE_TTL_MS) true for ERROR_BACKOFF_MS duration.
  if (cachedRanges === null && cachedAt > 0 && now - cachedAt < CACHE_TTL_MS) {
    return { ipv4Cidrs: [], ipv6Cidrs: [] };
  }

  // Request coalescing: return active promise if one is in progress
  if (activePromise !== null) {
    return activePromise;
  }

  activePromise = (async () => {
    try {
      const res = await fetch(CLOUDFLARE_IPS_URL, {
        headers: {
          ...(process.env.EXTERNAL_USER_AGENT
            ? { "User-Agent": process.env.EXTERNAL_USER_AGENT }
            : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Cloudflare IPs: ${res.status}`);
      }

      const data = await res.json();

      cachedRanges = {
        ipv4Cidrs: data.result?.ipv4_cidrs || [],
        ipv6Cidrs: data.result?.ipv6_cidrs || [],
      };
      // Parse CIDRs once when caching
      parsedRanges = parseCidrs(cachedRanges);
      cachedAt = Date.now();
      return cachedRanges;
    } catch {
      // Update cachedAt even on error to implement backoff
      cachedAt = Date.now() - CACHE_TTL_MS + ERROR_BACKOFF_MS;
      // Return cached ranges if available, otherwise empty
      return cachedRanges ?? { ipv4Cidrs: [], ipv6Cidrs: [] };
    } finally {
      activePromise = null;
    }
  })();

  return activePromise;
}

/**
 * Check if a given IP address is part of Cloudflare's IP ranges.
 */
export async function isCloudflareIp(ip: string): Promise<boolean> {
  const cached = cache.get(ip);
  if (cached !== undefined) {
    return cached;
  }

  // Ensure ranges are fetched and parsed
  await getCloudflareIpRanges();

  // Use pre-parsed ranges for efficient matching
  if (!parsedRanges) {
    cache.set(ip, false);
    return false;
  }

  let result = false;

  if (ipaddr.IPv4.isValid(ip)) {
    const parsed = ipaddr.IPv4.parse(ip);
    result = parsedRanges.ipv4.some(([net, prefix]) =>
      parsed.match([net, prefix]),
    );
  } else if (ipaddr.IPv6.isValid(ip)) {
    const parsed = ipaddr.IPv6.parse(ip);
    result = parsedRanges.ipv6.some(([net, prefix]) =>
      parsed.match([net, prefix]),
    );
  }

  cache.set(ip, result);
  return result;
}
