import "server-only";

import * as ipaddr from "ipaddr.js";
import { LRUCache } from "lru-cache";

/**
 * Cloudflare IP Ranges URL.
 * This JSON file contains the IP ranges for Cloudflare's network.
 * @see https://developers.cloudflare.com/api/resources/ips/methods/list/
 */
const CLOUDFLARE_IPS_URL = "https://api.cloudflare.com/client/v4/ips";

/**
 * LRU cache for Cloudflare IP check results (cross-request).
 *
 * Same IPs are checked repeatedly across different domains:
 * - Cloudflare edge IPs are shared by many websites
 * - DNS workflows check A/AAAA records for each domain
 *
 * With Fluid Compute, this cache persists across requests in the same instance.
 */
const cache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 800_000, // 800 seconds (theoretical max duration of a fluid instance)
});

export interface CloudflareIpRanges {
  ipv4Cidrs: string[];
  ipv6Cidrs: string[];
}

/**
 * Fetch Cloudflare IP ranges with Next.js Data Cache.
 */
async function getCloudflareIpRanges(): Promise<CloudflareIpRanges> {
  try {
    const res = await fetch(CLOUDFLARE_IPS_URL, {
      headers: {
        ...(process.env.EXTERNAL_USER_AGENT
          ? { "User-Agent": process.env.EXTERNAL_USER_AGENT }
          : {}),
      },
      next: {
        revalidate: 604_800, // 1 week
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Cloudflare IPs: ${res.status}`);
    }

    const data = await res.json();

    return {
      ipv4Cidrs: data.result?.ipv4_cidrs || [],
      ipv6Cidrs: data.result?.ipv6_cidrs || [],
    };
  } catch {
    return { ipv4Cidrs: [], ipv6Cidrs: [] };
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
 *
 * LRU cache persists across requests in Fluid Compute.
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
