import * as ipaddr from "ipaddr.js";
import { LRUCache } from "lru-cache";

/**
 * Check if an IP address is in a private/reserved range.
 * Returns true for localhost, private networks, link-local, etc.
 */
export function isPrivateIp(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    return parsed.range() !== "unicast";
  } catch {
    // Invalid IP - treat as blocked for safety
    return true;
  }
}

// Cache for Cloudflare IP check results
const cloudflareCache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 3_600_000, // 1 hour
});

// Cache for Cloudflare IP ranges
let cloudflareRanges: { ipv4: string[]; ipv6: string[] } | null = null;
let cloudflareRangesFetchedAt = 0;
const RANGES_TTL = 3_600_000; // 1 hour

/**
 * Fetch Cloudflare IP ranges from their public API.
 */
async function getCloudflareRanges(
  userAgent: string,
): Promise<{ ipv4: string[]; ipv6: string[] }> {
  const now = Date.now();

  // Return cached ranges if still valid
  if (cloudflareRanges && now - cloudflareRangesFetchedAt < RANGES_TTL) {
    return cloudflareRanges;
  }

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/ips", {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    cloudflareRanges = {
      ipv4: data.result?.ipv4_cidrs ?? [],
      ipv6: data.result?.ipv6_cidrs ?? [],
    };
    cloudflareRangesFetchedAt = now;
    return cloudflareRanges;
  } catch {
    // Return empty on failure - graceful degradation
    return cloudflareRanges ?? { ipv4: [], ipv6: [] };
  }
}

/**
 * Check if an IP address belongs to Cloudflare's network.
 */
export async function isCloudflareIp(
  ip: string,
  userAgent: string,
): Promise<boolean> {
  const cached = cloudflareCache.get(ip);
  if (cached !== undefined) {
    return cached;
  }

  const ranges = await getCloudflareRanges(userAgent);
  let result = false;

  try {
    if (ipaddr.IPv4.isValid(ip)) {
      const parsed = ipaddr.IPv4.parse(ip);
      result = ranges.ipv4.some((cidr) => isInCidr(parsed, cidr));
    } else if (ipaddr.IPv6.isValid(ip)) {
      const parsed = ipaddr.IPv6.parse(ip);
      result = ranges.ipv6.some((cidr) => isInCidr(parsed, cidr));
    }
  } catch {
    result = false;
  }

  cloudflareCache.set(ip, result);
  return result;
}

function isInCidr(ip: ipaddr.IPv4 | ipaddr.IPv6, cidr: string): boolean {
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
