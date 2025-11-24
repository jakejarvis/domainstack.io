import "server-only";

import * as ipaddr from "ipaddr.js";
import { CLOUDFLARE_IPS_URL } from "@/lib/constants/external-apis";
import { ipV4InCidr, ipV6InCidr } from "@/lib/ip";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "cloudflare-ips" });

export interface CloudflareIpRanges {
  ipv4Cidrs: string[];
  ipv6Cidrs: string[];
}

let lastLoadedIpv4Parsed: Array<[ipaddr.IPv4, number]> | undefined;
let lastLoadedIpv6Parsed: Array<[ipaddr.IPv6, number]> | undefined;

/**
 * Fetch Cloudflare IP ranges from their API.
 */
async function fetchCloudflareIpRanges(): Promise<CloudflareIpRanges> {
  const res = await fetch(CLOUDFLARE_IPS_URL, {
    next: {
      revalidate: 604800, // 1 week
      tags: ["cloudflare-ip-ranges"],
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Cloudflare IPs: ${res.status}`);
  }

  const data = await res.json();

  logger.info("IP ranges fetched");

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
 * Fetch Cloudflare IP ranges with Next.js Data Cache.
 *
 * The IP ranges change infrequently (when Cloudflare expands infrastructure),
 * so we cache for 1 week with stale-while-revalidate.
 */
async function getCloudflareIpRanges(): Promise<CloudflareIpRanges> {
  try {
    const ranges = await fetchCloudflareIpRanges();
    parseAndCacheRanges(ranges);
    return ranges;
  } catch (err) {
    logger.error("fetch error", err);
    // Return empty ranges on error
    return { ipv4Cidrs: [], ipv6Cidrs: [] };
  }
}

/**
 * Check if a given IP address is part of Cloudflare's IP ranges.
 * Uses per-request React cache() for deduplication.
 */
export async function isCloudflareIp(ip: string): Promise<boolean> {
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
}
