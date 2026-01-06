import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dnsRecords, type dnsRecordType } from "@/lib/db/schema";

type DnsRecordInsert = InferInsertModel<typeof dnsRecords>;

export type UpsertDnsParams = {
  domainId: string;
  resolver: string;
  fetchedAt: Date;
  // complete set per type
  recordsByType: Record<
    (typeof dnsRecordType.enumValues)[number],
    Array<
      Omit<
        DnsRecordInsert,
        "id" | "domainId" | "type" | "resolver" | "fetchedAt"
      >
    >
  >;
};

/**
 * Generate a unique key for a DNS record.
 * TXT records preserve case for values (e.g., verification tokens).
 * All other record types normalize values to lowercase.
 * Names (hostnames) are always normalized to lowercase per RFC 1035.
 */
function makeDnsRecordKey(
  type: string,
  name: string,
  value: string,
  priority: number | null,
): string {
  const priorityPart = priority != null ? `|${priority}` : "";
  const normalizedName = name.trim().toLowerCase();
  // TXT values preserve case; all others normalize to lowercase
  const normalizedValue =
    type === "TXT" ? value.trim() : value.trim().toLowerCase();
  return `${type}|${normalizedName}|${normalizedValue}${priorityPart}`;
}

export async function replaceDns(params: UpsertDnsParams) {
  const { domainId, recordsByType } = params;

  // Fetch all existing records for all types in a single query
  const allExisting = await db
    .select({
      id: dnsRecords.id,
      type: dnsRecords.type,
      name: dnsRecords.name,
      value: dnsRecords.value,
      priority: dnsRecords.priority,
    })
    .from(dnsRecords)
    .where(eq(dnsRecords.domainId, domainId));

  // Build a map of existing records for quick lookup
  const existingMap = new Map<string, string>();
  for (const record of allExisting) {
    const key = makeDnsRecordKey(
      record.type,
      record.name,
      record.value,
      record.priority,
    );
    existingMap.set(key, record.id);
  }

  // Collect all records to upsert and records to delete
  const allRecordsToUpsert: DnsRecordInsert[] = [];

  const allNextKeys = new Set<string>();

  for (const type of Object.keys(recordsByType) as Array<
    (typeof dnsRecordType.enumValues)[number]
  >) {
    // TXT records preserve case (e.g., verification tokens like google-site-verification)
    // All other record types normalize to lowercase for consistent storage.
    // Hostnames are case-insensitive per RFC 1035; IP addresses have no case.
    const preserveValueCase = type === "TXT";

    const next = (recordsByType[type] ?? []).map((r) => ({
      ...r,
      type,
      // Always normalize name (hostname) to lowercase
      name: (r.name as string).trim().toLowerCase(),
      // Normalize value to lowercase except for TXT records
      value: preserveValueCase
        ? (r.value as string).trim()
        : (r.value as string).trim().toLowerCase(),
    }));

    for (const r of next) {
      // Values are already normalized above, so we can pass them directly.
      // makeDnsRecordKey handles the TXT case-sensitivity logic.
      const key = makeDnsRecordKey(type, r.name, r.value, r.priority ?? null);

      // Skip duplicates within the same batch
      if (allNextKeys.has(key)) {
        continue;
      }

      allNextKeys.add(key);

      allRecordsToUpsert.push({
        domainId,
        type,
        name: r.name,
        value: r.value,
        ttl: r.ttl ?? null,
        priority: r.priority ?? null,
        isCloudflare: r.isCloudflare ?? null,
        resolver: params.resolver,
        fetchedAt: params.fetchedAt,
        expiresAt: r.expiresAt,
      });
    }
  }

  // Identify records to delete (exist in DB but not in the new set)
  const idsToDelete = allExisting
    .filter((e) => {
      const key = makeDnsRecordKey(e.type, e.name, e.value, e.priority);
      return !allNextKeys.has(key);
    })
    .map((e) => e.id);

  // Delete obsolete records
  if (idsToDelete.length > 0) {
    await db.delete(dnsRecords).where(inArray(dnsRecords.id, idsToDelete));
  }

  // Batch upsert all records
  if (allRecordsToUpsert.length > 0) {
    await db
      .insert(dnsRecords)
      .values(allRecordsToUpsert)
      .onConflictDoUpdate({
        target: [
          dnsRecords.domainId,
          dnsRecords.type,
          dnsRecords.name,
          dnsRecords.value,
          dnsRecords.priority,
        ],
        set: {
          ttl: sql`excluded.${sql.identifier(dnsRecords.ttl.name)}`,
          isCloudflare: sql`excluded.${sql.identifier(dnsRecords.isCloudflare.name)}`,
          resolver: sql`excluded.${sql.identifier(dnsRecords.resolver.name)}`,
          fetchedAt: sql`excluded.${sql.identifier(dnsRecords.fetchedAt.name)}`,
          expiresAt: sql`excluded.${sql.identifier(dnsRecords.expiresAt.name)}`,
        },
      });
  }
}
