import "server-only";
import * as ipaddr from "ipaddr.js";
import { cacheLife } from "next/cache";
import { cache } from "react";
import { CLOUDFLARE_IPS_URL } from "@/lib/constants";
import { ipV4InCidr, ipV6InCidr } from "@/lib/ip";

export interface CloudflareIpRanges {
  ipv4Cidrs: string[];
  ipv6Cidrs: string[];
}

let lastLoadedIpv4Parsed: Array<[ipaddr.IPv4, number]> | undefined;
let lastLoadedIpv6Parsed: Array<[ipaddr.IPv6, number]> | undefined;

/**
 * Fetch Cloudflare IP ranges with Cache Components.
 *
 * The IP ranges change infrequently (when Cloudflare expands infrastructure),
 * so we cache for 1 day using Next.js 16 Cache Components.
 *
 * Also wrapped in React's cache() for per-request deduplication.
 */
const getCloudflareIpRanges = cache(async (): Promise<CloudflareIpRanges> => {
  "use cache";
  cacheLife("days");

  const res = await fetch(CLOUDFLARE_IPS_URL);

  if (!res.ok) {
    throw new Error(`Failed to fetch Cloudflare IPs: ${res.status}`);
  }

  const data = await res.json();

  const ranges: CloudflareIpRanges = {
    ipv4Cidrs: data.result?.ipv4_cidrs || [],
    ipv6Cidrs: data.result?.ipv6_cidrs || [],
  };

  // Pre-parse IPv4 CIDRs for fast sync/async checks
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

  // Pre-parse IPv6 CIDRs for fast sync/async checks
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

  return ranges;
});

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
