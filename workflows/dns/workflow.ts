import { FatalError, RetryableError } from "workflow";
import { DNS_RECORD_TYPES } from "@/lib/constants/dns";
import type { DnsRecord, DnsRecordsResponse, DnsRecordType } from "@/lib/types";

export interface DnsWorkflowInput {
  domain: string;
}

export interface DnsWorkflowResult {
  success: boolean;
  data: DnsRecordsResponse;
}

// Internal types for step-to-step transfer
// Note: Step throws RetryableError on failure, so only success type is needed
interface FetchResult {
  resolver: string;
  records: DnsRecord[];
  // Records with expiry info for persistence
  recordsWithExpiry: Array<
    DnsRecord & {
      expiresAt: string; // ISO string for serialization
    }
  >;
}

/**
 * Durable DNS workflow that breaks down DNS resolution into
 * independently retryable steps:
 * 1. Fetch from DoH providers with fallback
 * 2. Persist to database (creates domain record if needed)
 */
export async function dnsWorkflow(
  input: DnsWorkflowInput,
): Promise<DnsWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch from DoH providers (throws RetryableError on failure)
  const fetchResult = await fetchFromProviders(domain);

  // Step 2: Persist to database
  await persistRecords(
    domain,
    fetchResult.resolver,
    fetchResult.recordsWithExpiry,
  );

  return {
    success: true,
    data: {
      records: fetchResult.records,
      resolver: fetchResult.resolver,
    },
  };
}

/**
 * Step: Fetch DNS records from DoH providers with fallback
 */
async function fetchFromProviders(domain: string): Promise<FetchResult> {
  "use step";

  const { DNS_TYPE_NUMBERS, providerOrderForLookup, queryDohProvider } =
    await import("@/lib/dns-utils");
  const { isCloudflareIp } = await import("@/lib/cloudflare");
  const { ttlForDnsRecord } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "dns-workflow" });
  const providers = providerOrderForLookup(domain);
  const types = DNS_RECORD_TYPES;
  const now = new Date();

  for (const provider of providers) {
    try {
      const results = await Promise.all(
        types.map(async (type) => {
          const answers = await queryDohProvider(provider, domain, type, {
            timeoutMs: 2000,
            retries: 1,
            backoffMs: 150,
          });

          const records: DnsRecord[] = [];
          for (const a of answers) {
            // Filter out records that don't match requested type
            const expectedTypeNumber = DNS_TYPE_NUMBERS[type];
            if (a.type !== expectedTypeNumber) continue;

            const name = a.name.endsWith(".") ? a.name.slice(0, -1) : a.name;
            const ttl = a.TTL;

            switch (type) {
              case "A":
              case "AAAA": {
                const value = a.data.endsWith(".")
                  ? a.data.slice(0, -1)
                  : a.data;
                const isCloudflare = await isCloudflareIp(value);
                records.push({ type, name, value, ttl, isCloudflare });
                break;
              }
              case "NS": {
                const value = a.data.endsWith(".")
                  ? a.data.slice(0, -1)
                  : a.data;
                records.push({ type, name, value, ttl });
                break;
              }
              case "TXT": {
                const value = a.data.replace(/^"|"$/g, "");
                records.push({ type, name, value, ttl });
                break;
              }
              case "MX": {
                const [prioStr, ...hostParts] = a.data.split(" ");
                const priority = Number(prioStr);
                let host = hostParts.join(" ");
                host = host.endsWith(".") ? host.slice(0, -1) : host;
                if (!host) continue;
                records.push({
                  type,
                  name,
                  value: host,
                  ttl,
                  priority: Number.isFinite(priority) ? priority : 0,
                });
                break;
              }
            }
          }
          return records;
        }),
      );

      const flat = results.flat();
      const deduplicated = deduplicateDnsRecords(flat);
      const sorted = sortDnsRecordsByType(deduplicated, types);

      // Build records with expiry for persistence
      const recordsWithExpiry = flat.map((r) => ({
        type: r.type,
        name: r.name,
        value: r.value,
        ttl: r.ttl ?? undefined,
        priority: r.priority ?? undefined,
        isCloudflare: r.isCloudflare ?? undefined,
        expiresAt: ttlForDnsRecord(now, r.ttl ?? undefined).toISOString(),
      }));

      return {
        records: sorted,
        resolver: provider.key,
        recordsWithExpiry,
      };
    } catch (err) {
      logger.info({ err, domain, provider: provider.key }, "provider failed");
      // Try next provider
    }
  }

  // All providers failed - this is likely transient, throw to trigger retry
  logger.warn({ domain }, "all DoH providers failed, will retry");
  throw new RetryableError("All DoH providers failed", { retryAfter: "5s" });
}

// Allow more retries for DNS since DoH providers can be flaky
fetchFromProviders.maxRetries = 5;

/**
 * Step: Persist DNS records to database
 */
async function persistRecords(
  domain: string,
  resolver: string,
  recordsWithExpiry: Array<DnsRecord & { expiresAt: string }>,
): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceDns } = await import("@/lib/db/repos/dns");
  const { scheduleRevalidation } = await import("@/lib/schedule");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "dns-workflow" });
  const types = DNS_RECORD_TYPES;
  const now = new Date();

  try {
    // Ensure domain record exists (creates if needed)
    const domainRecord = await ensureDomainRecord(domain);

    // Group records by type for replaceDns
    const recordsByType = Object.fromEntries(
      types.map((t) => [
        t,
        recordsWithExpiry
          .filter((r) => r.type === t)
          .map((r) => ({
            name: r.name,
            value: r.value,
            ttl: r.ttl,
            priority: r.priority,
            isCloudflare: r.isCloudflare,
            expiresAt: new Date(r.expiresAt),
          })),
      ]),
    ) as Record<
      DnsRecordType,
      Array<{
        name: string;
        value: string;
        ttl: number | null;
        priority: number | null;
        isCloudflare: boolean | null;
        expiresAt: Date;
      }>
    >;

    await replaceDns({
      domainId: domainRecord.id,
      resolver,
      fetchedAt: now,
      recordsByType,
    });

    // Schedule revalidation
    const times = recordsWithExpiry
      .map((r) => new Date(r.expiresAt).getTime())
      .filter((t) => Number.isFinite(t));
    const soonest = times.length > 0 ? Math.min(...times) : now.getTime();

    await scheduleRevalidation(
      domain,
      "dns",
      soonest,
      domainRecord.lastAccessedAt ?? null,
    );

    logger.debug(
      { domain, recordCount: recordsWithExpiry.length },
      "dns records persisted",
    );
  } catch (err) {
    logger.error({ err, domain }, "failed to persist dns records");
    throw new FatalError("Failed to persist DNS records");
  }
}

// Helper functions used in fetchFromProviders step
function deduplicateDnsRecords(records: DnsRecord[]): DnsRecord[] {
  const seen = new Set<string>();
  const deduplicated: DnsRecord[] = [];

  for (const r of records) {
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
  order: readonly DnsRecordType[],
): DnsRecord[] {
  const byType: Record<DnsRecordType, DnsRecord[]> = {
    A: [],
    AAAA: [],
    MX: [],
    TXT: [],
    NS: [],
  };
  for (const r of records) byType[r.type].push(r);

  const sorted: DnsRecord[] = [];
  for (const t of order) {
    sorted.push(...sortDnsRecordsForType(byType[t], t));
  }
  return sorted;
}

function sortDnsRecordsForType(
  arr: DnsRecord[],
  type: DnsRecordType,
): DnsRecord[] {
  if (type === "MX") {
    arr.sort((a, b) => {
      const ap = a.priority ?? Number.MAX_SAFE_INTEGER;
      const bp = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.value.localeCompare(b.value);
    });
    return arr;
  }
  arr.sort((a, b) => a.value.localeCompare(b.value));
  return arr;
}
