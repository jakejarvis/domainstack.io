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

/**
 * Fetch Cloudflare IP ranges.
 */
// Cache Cloudflare IP ranges in memory (refreshed weekly)
let cachedRanges: CloudflareIpRanges | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 604_800_000; // 1 week

async function getCloudflareIpRanges(): Promise<CloudflareIpRanges> {
  // Return cached ranges if still valid
  if (cachedRanges && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedRanges;
  }

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
    cachedAt = Date.now();
    return cachedRanges;
  } catch {
    // Return cached ranges if available, otherwise empty
    return cachedRanges ?? { ipv4Cidrs: [], ipv6Cidrs: [] };
  }
}

function isIpInCidr(ip: ipaddr.IPv4 | ipaddr.IPv6, cidr: string): boolean {
  try {
    const [net, prefix] = ipaddr.parseCIDR(cidr);
    if (net.kind() !== ip.kind()) return false;
    return ip.match([net, prefix] as
      | [ipaddr.IPv4, number]
      | [ipaddr.IPv6, number]);
  } catch {
    return false;
  }
}

/**
 * Check if a given IP address is part of Cloudflare's IP ranges.
 */
export async function isCloudflareIp(ip: string): Promise<boolean> {
  const cached = cache.get(ip);
  if (cached !== undefined) {
    return cached;
  }

  const ranges = await getCloudflareIpRanges();
  let result = false;

  if (ipaddr.IPv4.isValid(ip)) {
    const parsed = ipaddr.IPv4.parse(ip);
    result = ranges.ipv4Cidrs.some((cidr) => isIpInCidr(parsed, cidr));
  } else if (ipaddr.IPv6.isValid(ip)) {
    const parsed = ipaddr.IPv6.parse(ip);
    result = ranges.ipv6Cidrs.some((cidr) => isIpInCidr(parsed, cidr));
  }

  cache.set(ip, result);
  return result;
}
