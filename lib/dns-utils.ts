import { USER_AGENT } from "@/lib/constants/app";
import { simpleHash } from "@/lib/hash";
import type { DnsType } from "@/lib/schemas";

export type DohProvider = {
  key: string;
  url: string;
  headers?: Record<string, string>;
};

export type DnsJson = {
  Status: number;
  Answer?: DnsAnswer[];
};

export type DnsAnswer = {
  name: string;
  type: number;
  TTL: number;
  data: string;
};

export const DOH_HEADERS: Record<string, string> = {
  accept: "application/dns-json",
  "user-agent": USER_AGENT,
};

export const DOH_PROVIDERS: DohProvider[] = [
  {
    key: "cloudflare",
    url: "https://cloudflare-dns.com/dns-query",
  },
  {
    key: "google",
    url: "https://dns.google/resolve",
  },
  // {
  //   key: "quad9",
  //   // dns10 is the unfiltered server
  //   url: "https://dns10.quad9.net/dns-query",
  // },
];

// DNS record type numbers (RFC 1035)
export const DNS_TYPE_NUMBERS = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  NS: 2,
} as const;

export function buildDohUrl(
  provider: DohProvider,
  domain: string,
  type: DnsType | string,
): URL {
  const url = new URL(provider.url);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);
  return url;
}

export function providerOrderForLookup(domain: string): DohProvider[] {
  // Deterministic provider selection based on domain hash for cache consistency
  // Same domain always uses same primary provider, with others as fallbacks
  const hash = simpleHash(domain.toLowerCase());
  const primaryIndex = hash % DOH_PROVIDERS.length;

  // Return primary provider first, followed by others in original order
  const primary = DOH_PROVIDERS[primaryIndex] as DohProvider;
  const fallbacks = DOH_PROVIDERS.filter((_, i) => i !== primaryIndex);

  return [primary, ...fallbacks];
}
