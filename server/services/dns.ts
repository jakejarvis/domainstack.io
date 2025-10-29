import { eq } from "drizzle-orm";
import { acquireLockOrWaitForResult } from "@/lib/cache";
import { isCloudflareIpAsync } from "@/lib/cloudflare";
import { USER_AGENT } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { replaceDns } from "@/lib/db/repos/dns";
import { findDomainByName } from "@/lib/db/repos/domains";
import { dnsRecords } from "@/lib/db/schema";
import { ttlForDnsRecord } from "@/lib/db/ttl";
import { toRegistrableDomain } from "@/lib/domain-server";
import { fetchWithTimeout } from "@/lib/fetch";
import { ns } from "@/lib/redis";
import { scheduleSectionIfEarlier } from "@/lib/schedule";
import {
  type DnsRecord,
  type DnsResolveResult,
  type DnsResolver,
  type DnsType,
  DnsTypeSchema,
} from "@/lib/schemas";

export type DohProvider = {
  key: DnsResolver;
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
  {
    key: "quad9",
    // dns10 is the unfiltered server
    url: "https://dns10.quad9.net/dns-query",
  },
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

export async function resolveAll(domain: string): Promise<DnsResolveResult> {
  console.debug(`[dns] start ${domain}`);

  // Try to acquire lock or wait for result from concurrent caller
  const lockKey = ns("dns:lock", domain);
  const resultKey = ns("dns:result", domain);

  const lockResult = await acquireLockOrWaitForResult<DnsResolveResult>({
    lockKey,
    resultKey,
    lockTtl: 30,
    pollIntervalMs: 100,
    maxWaitMs: 5000,
  });

  if (!lockResult.acquired && lockResult.cachedResult) {
    console.debug(`[dns] cache hit concurrent ${domain}`);
    return lockResult.cachedResult;
  }

  // Lock acquired or no cached result - perform resolution
  try {
    const result = await resolveAllInternal(domain);

    // Cache result for other concurrent callers
    try {
      const { redis } = await import("@/lib/redis");
      await redis.set(resultKey, result, { ex: 5 });
    } catch (err) {
      console.debug(
        `[dns] redis result cache failed ${domain}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }

    return result;
  } finally {
    // Release lock
    try {
      const { redis } = await import("@/lib/redis");
      await redis.del(lockKey);
    } catch (err) {
      console.debug(
        `[dns] redis lock release failed ${domain}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }
}

async function resolveAllInternal(domain: string): Promise<DnsResolveResult> {
  const providers = providerOrderForLookup(domain);
  const durationByProvider: Record<string, number> = {};
  let lastError: unknown = null;
  const types = DnsTypeSchema.options;

  // Only support registrable domains (no subdomains, IPs, or invalid TLDs)
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new Error(`Cannot extract registrable domain from ${domain}`);
  }

  // Fast path: Check Postgres for cached DNS records
  const existingDomain = await findDomainByName(registrable);
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
    resolver: DnsResolver | null;
    expiresAt: Date | null;
  }>;
  if (rows.length > 0) {
    const now = Date.now();
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
        arr.every((r) => (r.expiresAt?.getTime?.() ?? 0) > now)
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
    const resolverHint = (rows[0]?.resolver ?? "cloudflare") as DnsResolver;
    const sorted = sortDnsRecordsByType(assembled, types);
    if (allFreshAcrossTypes) {
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
        const nowDate = new Date();
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
                expiresAt: ttlForDnsRecord(nowDate, r.ttl ?? null),
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
            fetchedAt: nowDate,
            recordsByType: recordsByTypeToPersist,
          });
          try {
            const times = Object.values(recordsByTypeToPersist)
              .flat()
              .map((r) => r.expiresAt?.getTime?.())
              .filter(
                (t): t is number => typeof t === "number" && Number.isFinite(t),
              );
            // Always schedule: use the soonest expiry if available, otherwise schedule immediately
            const soonest = times.length > 0 ? Math.min(...times) : Date.now();
            await scheduleSectionIfEarlier("dns", registrable, soonest);
          } catch (err) {
            console.warn(
              `[dns] schedule failed partial ${registrable}`,
              err instanceof Error ? err : new Error(String(err)),
            );
          }
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
        const merged = sortDnsRecordsByType(
          [...cachedFresh, ...fetchedStale],
          types,
        );
        const counts = (types as DnsType[]).reduce(
          (acc, t) => {
            acc[t] = merged.filter((r) => r.type === t).length;
            return acc;
          },
          { A: 0, AAAA: 0, MX: 0, TXT: 0, NS: 0 } as Record<DnsType, number>,
        );
        console.info(
          `[dns] ok partial ${registrable} counts=${JSON.stringify(counts)} resolver=${pinnedProvider.key} duration=${durationByProvider[pinnedProvider.key]}ms`,
        );
        return {
          records: merged,
          resolver: pinnedProvider.key,
        } as DnsResolveResult;
      } catch (err) {
        console.warn(
          `[dns] partial refresh failed ${registrable} provider=${pinnedProvider.key}`,
          err instanceof Error ? err : new Error(String(err)),
        );
        // Fall through to full provider loop below
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
      if (existingDomain) {
        await replaceDns({
          domainId: existingDomain.id,
          resolver: resolverUsed,
          fetchedAt: now,
          recordsByType: Object.fromEntries(
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
          >,
        });
        try {
          const times = Object.values(recordsByType)
            .flat()
            .map((r) => ttlForDnsRecord(now, r.ttl ?? null)?.getTime?.())
            .filter(
              (t): t is number => typeof t === "number" && Number.isFinite(t),
            );
          const soonest = times.length > 0 ? Math.min(...times) : now.getTime();
          await scheduleSectionIfEarlier("dns", registrable, soonest);
        } catch (err) {
          console.warn(
            `[dns] schedule failed full ${registrable}`,
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      }
      console.info(
        `[dns] ok ${registrable} counts=${JSON.stringify(counts)} resolver=${resolverUsed} durations=${JSON.stringify(durationByProvider)}`,
      );
      return { records: flat, resolver: resolverUsed } as DnsResolveResult;
    } catch (err) {
      console.warn(
        `[dns] provider attempt failed ${registrable} provider=${provider.key}`,
        err instanceof Error ? err : new Error(String(err)),
      );
      durationByProvider[provider.key] = Date.now() - attemptStart;
      lastError = err;
      // Try next provider in rotation
    }
  }

  // All providers failed
  console.error(
    `[dns] all providers failed ${registrable} tried=${providers.map((p) => p.key).join(",")}`,
    lastError,
  );
  throw new Error(
    `All DoH providers failed for ${registrable}: ${String(lastError)}`,
  );
}

async function resolveTypeWithProvider(
  domain: string,
  type: DnsType,
  provider: DohProvider,
): Promise<DnsRecord[]> {
  const url = buildDohUrl(provider, domain, type);
  const res = await fetchWithTimeout(
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

function normalizeAnswer(
  _domain: string,
  type: DnsType,
  a: DnsAnswer,
): Promise<DnsRecord | undefined> | DnsRecord | undefined {
  const name = trimDot(a.name);
  const ttl = a.TTL;
  switch (type) {
    case "A":
    case "AAAA": {
      const value = trimDot(a.data);
      const isCloudflarePromise = isCloudflareIpAsync(value);
      return isCloudflarePromise.then((isCloudflare) => ({
        type,
        name,
        value,
        ttl,
        isCloudflare,
      }));
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
  if (type === "TXT" || type === "NS") {
    arr.sort((a, b) => a.value.localeCompare(b.value));
    return arr;
  }
  // For A/AAAA retain provider order
  return arr;
}

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

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
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
