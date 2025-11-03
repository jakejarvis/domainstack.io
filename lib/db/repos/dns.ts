import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dnsRecords, type dnsRecordType } from "@/lib/db/schema";
import { DnsRecordInsert as DnsRecordInsertSchema } from "@/lib/db/zod";

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
    const priorityPart = record.priority != null ? `|${record.priority}` : "";
    const key = `${record.type}|${record.name.trim().toLowerCase()}|${record.value.trim().toLowerCase()}${priorityPart}`;
    existingMap.set(key, record.id);
  }

  // Collect all records to upsert and records to delete
  const allRecordsToUpsert: ReturnType<typeof DnsRecordInsertSchema.parse>[] =
    [];

  const allNextKeys = new Set<string>();

  for (const type of Object.keys(recordsByType) as Array<
    (typeof dnsRecordType.enumValues)[number]
  >) {
    const next = (recordsByType[type] ?? []).map((r) => ({
      ...r,
      type,
      // Trim but preserve original case for DNS records
      name: (r.name as string).trim(),
      value: (r.value as string).trim(),
    }));

    for (const r of next) {
      // Include priority in the uniqueness key for MX/SRV records
      // (same host with different priorities = different records)
      // Use lowercase for case-insensitive deduplication, but store original case
      const priorityPart = r.priority != null ? `|${r.priority}` : "";
      const key = `${type}|${r.name.toLowerCase()}|${r.value.toLowerCase()}${priorityPart}`;

      // Skip duplicates within the same batch
      if (allNextKeys.has(key)) {
        continue;
      }

      allNextKeys.add(key);

      allRecordsToUpsert.push(
        DnsRecordInsertSchema.parse({
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
        }),
      );
    }
  }

  // Identify records to delete (exist in DB but not in the new set)
  const idsToDelete = allExisting
    .filter((e) => {
      const priorityPart = e.priority != null ? `|${e.priority}` : "";
      const key = `${e.type}|${e.name.trim().toLowerCase()}|${e.value.trim().toLowerCase()}${priorityPart}`;
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
