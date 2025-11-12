import "server-only";

import * as ipaddr from "ipaddr.js";
import { cache } from "react";
import {
  CLOUDFLARE_IPS_CACHE_TTL_SECONDS,
  CLOUDFLARE_IPS_URL,
} from "@/lib/constants";
import { ipV4InCidr, ipV6InCidr } from "@/lib/ip";
import { redis } from "@/lib/redis";

export interface CloudflareIpRanges {
  ipv4Cidrs: string[];
  ipv6Cidrs: string[];
}

const CACHE_KEY = "cloudflare:ip-ranges";

let lastLoadedIpv4Parsed: Array<[ipaddr.IPv4, number]> | undefined;
let lastLoadedIpv6Parsed: Array<[ipaddr.IPv6, number]> | undefined;

/**
 * Fetch Cloudflare IP ranges from their API.
 */
async function fetchCloudflareIpRanges(): Promise<CloudflareIpRanges> {
  const res = await fetch(CLOUDFLARE_IPS_URL);

  if (!res.ok) {
    throw new Error(`Failed to fetch Cloudflare IPs: ${res.status}`);
  }

  const data = await res.json();

  return {
    ipv4Cidrs: data.result?.ipv4_cidrs || [],
    ipv6Cidrs: data.result?.ipv6_cidrs || [],
  };
}

/**
 * Parse IP ranges into ipaddr.js objects for fast matching.
 * Updates module-level cache for synchronous access.
 */
function parseAndCacheRanges(ranges: CloudflareIpRanges): void {
  // Pre-parse IPv4 CIDRs for fast matching
  try {
    lastLoadedIpv4Parsed = ranges.ipv4Cidrs
      .map((cidr) => {
        try {
          const [net, prefix] = ipaddr.parseCIDR(cidr);
          if (net.kind() !== "ipv4") return undefined;
          return [net as ipaddr.IPv4, prefix] as [ipaddr.IPv4, number];
        } catch {
          return undefined;
        }
      })
      .filter(Boolean) as Array<[ipaddr.IPv4, number]>;
  } catch {
    lastLoadedIpv4Parsed = undefined;
  }

  // Pre-parse IPv6 CIDRs for fast matching
  try {
    lastLoadedIpv6Parsed = ranges.ipv6Cidrs
      .map((cidr) => {
        try {
          const [net, prefix] = ipaddr.parseCIDR(cidr);
          if (net.kind() !== "ipv6") return undefined;
          return [net as ipaddr.IPv6, prefix] as [ipaddr.IPv6, number];
        } catch {
          return undefined;
        }
      })
      .filter(Boolean) as Array<[ipaddr.IPv6, number]>;
  } catch {
    lastLoadedIpv6Parsed = undefined;
  }
}

/**
 * Fetch Cloudflare IP ranges with Redis caching.
 *
 * The IP ranges change infrequently (when Cloudflare expands infrastructure),
 * so we cache for 1 day in Redis. If multiple requests race to fetch, they will
 * all get the same data and cache it (acceptable for rarely-changing data).
 *
 * Also wrapped in React's cache() for per-request deduplication.
 */
const getCloudflareIpRanges = cache(async (): Promise<CloudflareIpRanges> => {
  // Try Redis cache first
  const cached = await redis.get<CloudflareIpRanges>(CACHE_KEY).catch((err) => {
    console.error(
      "[cloudflare-ips] cache read error",
      { cacheKey: CACHE_KEY },
      err instanceof Error ? err : new Error(String(err)),
    );
    return null;
  });
  if (cached) {
    parseAndCacheRanges(cached);
    return cached;
  }

  // Fetch fresh data
  try {
    const ranges = await fetchCloudflareIpRanges();

    // Cache for next time (fire-and-forget)
    redis
      .set(CACHE_KEY, ranges, { ex: CLOUDFLARE_IPS_CACHE_TTL_SECONDS })
      .catch((err) => {
        console.error(
          "[cloudflare-ips] cache write error",
          { cacheKey: CACHE_KEY },
          err instanceof Error ? err : new Error(String(err)),
        );
      });

    parseAndCacheRanges(ranges);
    console.info("[cloudflare-ips] IP ranges fetched (not cached)");
    return ranges;
  } catch (err) {
    console.error(
      "[cloudflare-ips] fetch error",
      err instanceof Error ? err : new Error(String(err)),
    );
    // Return empty ranges on error
    return { ipv4Cidrs: [], ipv6Cidrs: [] };
  }
});

/**
 * Check if a given IP address is part of Cloudflare's IP ranges.
 */
export const isCloudflareIp = cache(async (ip: string): Promise<boolean> => {
  const ranges = await getCloudflareIpRanges();

  if (ipaddr.IPv4.isValid(ip)) {
    const v4 = ipaddr.IPv4.parse(ip);
    if (lastLoadedIpv4Parsed && lastLoadedIpv4Parsed.length > 0) {
      return lastLoadedIpv4Parsed.some((range) => v4.match(range));
    }
    return ranges.ipv4Cidrs.some((cidr) => ipV4InCidr(v4, cidr));
  }

  if (ipaddr.IPv6.isValid(ip)) {
    const v6 = ipaddr.IPv6.parse(ip);
    // Prefer pre-parsed ranges if present
    if (lastLoadedIpv6Parsed && lastLoadedIpv6Parsed.length > 0) {
      return lastLoadedIpv6Parsed.some((range) => v6.match(range));
    }
    // Fallback to parsing on the fly
    return ranges.ipv6Cidrs.some((cidr) => ipV6InCidr(v6, cidr));
  }

  return false;
});
