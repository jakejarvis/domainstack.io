import { eq } from "drizzle-orm";
import { after } from "next/server";
import { cache } from "react";
import { isCloudflareIp } from "@/lib/cloudflare";
import { USER_AGENT } from "@/lib/constants/app";
import { db } from "@/lib/db/client";
import { replaceDns } from "@/lib/db/repos/dns";
import { findDomainByName } from "@/lib/db/repos/domains";
import { dnsRecords } from "@/lib/db/schema";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { simpleHash } from "@/lib/hash";
import { createLogger } from "@/lib/logger/server";
import { scheduleRevalidation } from "@/lib/schedule";
import {
  type DnsRecord,
  type DnsRecordsResponse,
  type DnsType,
  DnsTypeSchema,
} from "@/lib/schemas";
import { ttlForDnsRecord } from "@/lib/ttl";

const logger = createLogger({ source: "dns" });

// ============================================================================
// DNS resolution
// ============================================================================

type DnsJson = {
  Status: number;
  Answer?: DnsAnswer[];
};
type DnsAnswer = {
  name: string;
  type: number;
  TTL: number;
  data: string;
};

// DNS record type numbers (RFC 1035)
const DNS_TYPE_NUMBERS = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  NS: 2,
} as const;

export type DohProvider = {
  key: string;
  url: string;
  headers?: Record<string, string>;
};

const DEFAULT_HEADERS: Record<string, string> = {
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

function buildDohUrl(
  provider: DohProvider,
  domain: string,
  type: DnsType,
): URL {
  const url = new URL(provider.url);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);
  return url;
}

/**
 * Resolve all DNS record types for a domain with Postgres caching.
 *
 * Wrapped in React's cache() for per-request deduplication during SSR,
 * ensuring multiple services can query DNS without triggering duplicate
 * lookups to DoH providers.
 */
export const getDnsRecords = cache(async function getDnsRecords(
  domain: string,
): Promise<DnsRecordsResponse> {
  // Input domain is already normalized to registrable domain by router schema
  logger.debug("start", { domain });

  const providers = providerOrderForLookup(domain);
  const durationByProvider: Record<string, number> = {};
  let lastError: unknown = null;
  const types = DnsTypeSchema.options;

  // Generate single timestamp for access tracking and scheduling
  const now = new Date();
  const nowMs = now.getTime();

  // Fast path: Check Postgres for cached DNS records
  const existingDomain = await findDomainByName(domain);
  const rows = (
    existingDomain
      ? await db
          .select({
            type: dnsRecords.type,
            name: dnsRecords.name,
            value: dnsRecords.value,
            ttl: dnsRecords.ttl,
            priority: dnsRecords.priority,
            isCloudflare: dnsRecords.isCloudflare,
            resolver: dnsRecords.resolver,
            expiresAt: dnsRecords.expiresAt,
          })
          .from(dnsRecords)
          .where(eq(dnsRecords.domainId, existingDomain.id))
      : []
  ) as Array<{
    type: DnsType;
    name: string;
    value: string;
    ttl: number | null;
    priority: number | null;
    isCloudflare: boolean | null;
    resolver: string | null;
    expiresAt: Date | null;
  }>;
  if (rows.length > 0) {
    // Group cached rows by type
    const rowsByType = (rows as typeof rows).reduce(
      (acc, r) => {
        const t = r.type as DnsType;
        if (!acc[t]) {
          acc[t] = [] as typeof rows;
        }
        (acc[t] as typeof rows).push(r);
        return acc;
      },
      {
        // intentionally start empty; only present types will be keys
      } as Record<DnsType, typeof rows>,
    );
    const presentTypes = Object.keys(rowsByType) as DnsType[];
    const typeIsFresh = (t: DnsType) => {
      const arr = rowsByType[t] ?? [];
      return (
        arr.length > 0 &&
        arr.every((r) => (r.expiresAt?.getTime?.() ?? 0) > nowMs)
      );
    };
    const freshTypes = presentTypes.filter((t) => typeIsFresh(t));
    const allFreshAcrossTypes = (types as DnsType[]).every((t) =>
      typeIsFresh(t),
    );

    const assembled: DnsRecord[] = rows.map((r) => ({
      type: r.type as DnsType,
      name: r.name,
      value: r.value,
      ttl: r.ttl ?? undefined,
      priority: r.priority ?? undefined,
      isCloudflare: r.isCloudflare ?? undefined,
    }));
    const resolverHint = rows[0]?.resolver;
    // Deduplicate records from DB to prevent returning duplicates from cache
    const deduplicated = deduplicateDnsRecords(assembled);
    const sorted = sortDnsRecordsByType(deduplicated, types);
    if (allFreshAcrossTypes) {
      logger.info("cache hit", {
        domain,
        types: freshTypes.join(","),
        cached: true,
      });
      return { records: sorted, resolver: resolverHint };
    }

    // Partial revalidation for stale OR missing types using pinned provider
    const typesToFetch = (types as DnsType[]).filter((t) => !typeIsFresh(t));
    if (typesToFetch.length > 0) {
      const pinnedProvider =
        DOH_PROVIDERS.find((p) => p.key === resolverHint) ??
        providerOrderForLookup(domain)[0];
      const attemptStart = Date.now();
      try {
        const fetchedStale = (
          await Promise.all(
            typesToFetch.map(async (t) => {
              const recs = await resolveTypeWithProvider(
                domain,
                t,
                pinnedProvider,
              );
              return recs;
            }),
          )
        ).flat();
        durationByProvider[pinnedProvider.key] = Date.now() - attemptStart;

        // Persist only stale types
        const recordsByTypeToPersist = Object.fromEntries(
          typesToFetch.map((t) => [
            t,
            fetchedStale
              .filter((r) => r.type === t)
              .map((r) => ({
                name: r.name,
                value: r.value,
                ttl: r.ttl ?? null,
                priority: r.priority ?? null,
                isCloudflare: r.isCloudflare ?? null,
                expiresAt: ttlForDnsRecord(now, r.ttl ?? null),
              })),
          ]),
        ) as Record<
          DnsType,
          Array<{
            name: string;
            value: string;
            ttl: number | null;
            priority: number | null;
            isCloudflare: boolean | null;
            expiresAt: Date;
          }>
        >;
        // Persist to Postgres only if domain exists (i.e., is registered)
        if (existingDomain) {
          await replaceDns({
            domainId: existingDomain.id,
            resolver: pinnedProvider.key,
            fetchedAt: now,
            recordsByType: recordsByTypeToPersist,
          });
          after(() => {
            const times = Object.values(recordsByTypeToPersist)
              .flat()
              .map((r) => r.expiresAt?.getTime?.())
              .filter(
                (t): t is number => typeof t === "number" && Number.isFinite(t),
              );
            // Always schedule: use the soonest expiry if available, otherwise schedule immediately
            const soonest = times.length > 0 ? Math.min(...times) : Date.now();
            scheduleRevalidation(
              domain,
              "dns",
              soonest,
              existingDomain.lastAccessedAt ?? null,
            ).catch((err) => {
              logger.error("schedule failed partial", err, {
                domain,
                type: "partial",
              });
            });
          });
        }

        // Merge cached fresh + newly fetched stale
        const cachedFresh = freshTypes.flatMap((t) =>
          (rowsByType[t] ?? []).map((r) => ({
            type: r.type as DnsType,
            name: r.name,
            value: r.value,
            ttl: r.ttl ?? undefined,
            priority: r.priority ?? undefined,
            isCloudflare: r.isCloudflare ?? undefined,
          })),
        );
        // Deduplicate cachedFresh separately to ensure DB consistency
        const deduplicatedCachedFresh = deduplicateDnsRecords(cachedFresh);
        // Deduplicate merged results to prevent duplicates
        const deduplicated = deduplicateDnsRecords([
          ...deduplicatedCachedFresh,
          ...fetchedStale,
        ]);
        const merged = sortDnsRecordsByType(deduplicated, types);
        const counts = (types as DnsType[]).reduce(
          (acc, t) => {
            acc[t] = merged.filter((r) => r.type === t).length;
            return acc;
          },
          { A: 0, AAAA: 0, MX: 0, TXT: 0, NS: 0 } as Record<DnsType, number>,
        );

        logger.info("partial refresh done", {
          domain,
          counts,
          resolver: pinnedProvider.key,
          durationMs: durationByProvider[pinnedProvider.key],
        });
        return {
          records: merged,
          resolver: pinnedProvider.key,
        } as DnsRecordsResponse;
      } catch (err) {
        // Fall through to full provider loop below
        logger.error("partial refresh failed", err, {
          domain,
          provider: pinnedProvider.key,
        });
      }
    }
  }

  for (let attemptIndex = 0; attemptIndex < providers.length; attemptIndex++) {
    const provider = providers[attemptIndex] as DohProvider;
    const attemptStart = Date.now();
    try {
      const results = await Promise.all(
        types.map(async (type) => {
          return await resolveTypeWithProvider(domain, type, provider);
        }),
      );
      const flat = results.flat();
      durationByProvider[provider.key] = Date.now() - attemptStart;

      const counts = types.reduce(
        (acc, t) => {
          acc[t] = flat.filter((r) => r.type === t).length;
          return acc;
        },
        { A: 0, AAAA: 0, MX: 0, TXT: 0, NS: 0 } as Record<DnsType, number>,
      );
      const resolverUsed = provider.key;

      // Persist to Postgres
      const now = new Date();
      const recordsByType: Record<DnsType, DnsRecord[]> = {
        A: [],
        AAAA: [],
        MX: [],
        TXT: [],
        NS: [],
      };
      for (const r of flat) recordsByType[r.type].push(r);

      // Persist to Postgres only if domain exists (i.e., is registered)
      // Compute expiresAt for each record once before persistence
      const recordsByTypeToPersist = Object.fromEntries(
        (Object.keys(recordsByType) as DnsType[]).map((t) => [
          t,
          (recordsByType[t] as DnsRecord[]).map((r) => ({
            name: r.name,
            value: r.value,
            ttl: r.ttl ?? null,
            priority: r.priority ?? null,
            isCloudflare: r.isCloudflare ?? null,
            expiresAt: ttlForDnsRecord(now, r.ttl ?? null),
          })),
        ]),
      ) as Record<
        DnsType,
        Array<{
          name: string;
          value: string;
          ttl: number | null;
          priority: number | null;
          isCloudflare: boolean | null;
          expiresAt: Date;
        }>
      >;

      if (existingDomain) {
        await replaceDns({
          domainId: existingDomain.id,
          resolver: resolverUsed,
          fetchedAt: now,
          recordsByType: recordsByTypeToPersist,
        });

        after(() => {
          const times = Object.values(recordsByTypeToPersist)
            .flat()
            .map((r) => r.expiresAt?.getTime?.())
            .filter(
              (t): t is number => typeof t === "number" && Number.isFinite(t),
            );
          const soonest = times.length > 0 ? Math.min(...times) : now.getTime();
          scheduleRevalidation(
            domain,
            "dns",
            soonest,
            existingDomain.lastAccessedAt ?? null,
          ).catch((err) => {
            logger.error("schedule failed full", err, {
              domain,
              type: "full",
            });
          });
        });
      }
      logger.info("done", {
        domain,
        counts,
        resolver: resolverUsed,
        durationByProvider,
      });
      // Deduplicate records before returning (same logic as replaceDns uses for DB persistence)
      const deduplicated = deduplicateDnsRecords(flat);
      // Sort records deterministically to match cache-path ordering
      const sorted = sortDnsRecordsByType(deduplicated, types);
      return { records: sorted, resolver: resolverUsed } as DnsRecordsResponse;
    } catch (err) {
      logger.warn("provider attempt failed", {
        domain,
        provider: provider.key,
      });
      durationByProvider[provider.key] = Date.now() - attemptStart;
      lastError = err;
      // Try next provider in rotation
    }
  }

  // All providers failed
  const error = new Error(
    `All DoH providers failed for ${domain}: ${String(lastError)}`,
  );
  logger.error("all providers failed", error, {
    domain,
    providers: providers.map((p) => p.key).join(","),
  });
  throw error;
});

async function resolveTypeWithProvider(
  domain: string,
  type: DnsType,
  provider: DohProvider,
): Promise<DnsRecord[]> {
  const url = buildDohUrl(provider, domain, type);
  // Each DoH call is potentially flaky; short timeout + single retry keeps latency bounded.
  const res = await fetchWithTimeoutAndRetry(
    url,
    {
      headers: { ...DEFAULT_HEADERS, ...provider.headers },
    },
    { timeoutMs: 2000, retries: 1, backoffMs: 150 },
  );
  if (!res.ok) throw new Error(`DoH failed: ${provider.key} ${res.status}`);
  const json = (await res.json()) as DnsJson;
  const ans = json.Answer ?? [];
  const normalizedRecords = await Promise.all(
    ans.map((a) => normalizeAnswer(domain, type, a)),
  );
  const records = normalizedRecords.filter(Boolean) as DnsRecord[];
  return sortDnsRecordsForType(records, type);
}

async function normalizeAnswer(
  _domain: string,
  type: DnsType,
  a: DnsAnswer,
): Promise<DnsRecord | undefined> {
  const name = trimDot(a.name);
  const ttl = a.TTL;

  // Filter out records that don't match the requested type.
  // DoH resolvers include CNAME records in the answer chain when resolving A/AAAA,
  // but we only want the final resolved records of the requested type.
  const expectedTypeNumber = DNS_TYPE_NUMBERS[type];
  if (a.type !== expectedTypeNumber) {
    return undefined;
  }

  switch (type) {
    case "A":
    case "AAAA": {
      const value = trimDot(a.data);
      const isCloudflare = await isCloudflareIp(value);
      return {
        type,
        name,
        value,
        ttl,
        isCloudflare,
      };
    }
    case "NS": {
      return { type, name, value: trimDot(a.data), ttl };
    }
    case "TXT":
      return { type, name, value: trimQuotes(a.data), ttl };
    case "MX": {
      const [prioStr, ...hostParts] = a.data.split(" ");
      const priority = Number(prioStr);
      const host = trimDot(hostParts.join(" "));
      // Skip MX records with empty/invalid hosts
      if (!host) return undefined;
      return {
        type,
        name,
        value: host,
        ttl,
        priority: Number.isFinite(priority) ? priority : 0,
      };
    }
  }
}

function trimDot(s: string) {
  return s.endsWith(".") ? s.slice(0, -1) : s;
}
function trimQuotes(s: string) {
  // Cloudflare may return quoted strings; remove leading/trailing quotes
  return s.replace(/^"|"$/g, "");
}

/**
 * Deduplicate DNS records using the same logic as replaceDns.
 * Records are considered duplicates if they have the same type, name, value, and priority.
 * Case-insensitive comparison for name and value.
 */
function deduplicateDnsRecords(records: DnsRecord[]): DnsRecord[] {
  const seen = new Set<string>();
  const deduplicated: DnsRecord[] = [];

  for (const r of records) {
    // Use case-insensitive comparison, same as replaceDns
    const priorityPart = r.priority != null ? `|${r.priority}` : "";
    const key = `${r.type}|${r.name.trim().toLowerCase()}|${r.value.trim().toLowerCase()}${priorityPart}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(r);
    }
  }

  return deduplicated;
}

function sortDnsRecordsByType(
  records: DnsRecord[],
  order: readonly DnsType[],
): DnsRecord[] {
  const byType: Record<DnsType, DnsRecord[]> = {
    A: [],
    AAAA: [],
    MX: [],
    TXT: [],
    NS: [],
  };
  for (const r of records) byType[r.type].push(r);
  const sorted: DnsRecord[] = [];
  for (const t of order) {
    sorted.push(...sortDnsRecordsForType(byType[t] as DnsRecord[], t));
  }
  return sorted;
}

function sortDnsRecordsForType(arr: DnsRecord[], type: DnsType): DnsRecord[] {
  if (type === "MX") {
    arr.sort((a, b) => {
      const ap = (a.priority ?? Number.MAX_SAFE_INTEGER) as number;
      const bp = (b.priority ?? Number.MAX_SAFE_INTEGER) as number;
      if (ap !== bp) return ap - bp;
      return a.value.localeCompare(b.value);
    });
    return arr;
  }
  // For A, AAAA, TXT, and NS records: sort deterministically to prevent hydration errors
  // This ensures server and client render the same order
  arr.sort((a, b) => a.value.localeCompare(b.value));
  return arr;
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
