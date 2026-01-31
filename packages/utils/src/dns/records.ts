/**
 * DNS record utilities for deduplication and sorting.
 */

import type { DnsRecordType } from "@domainstack/constants";
import type { DnsRecord } from "@domainstack/types";

/**
 * Generate a unique key for a DNS record.
 * TXT records preserve case for values (e.g., verification tokens).
 * All other record types normalize values to lowercase.
 * Names (hostnames) are always normalized to lowercase per RFC 1035.
 */
export function makeDnsRecordKey(
  type: string,
  name: string,
  value: string,
  priority: number | null | undefined,
): string {
  const priorityPart = priority != null ? `|${priority}` : "";
  const normalizedName = name.trim().toLowerCase();
  // TXT values preserve case; all others normalize to lowercase
  const normalizedValue =
    type === "TXT" ? value.trim() : value.trim().toLowerCase();
  return `${type}|${normalizedName}|${normalizedValue}${priorityPart}`;
}

/**
 * Deduplicate DNS records.
 * Uses case-sensitive comparison for TXT values, case-insensitive for others.
 */
export function deduplicateDnsRecords(records: DnsRecord[]): DnsRecord[] {
  const seen = new Set<string>();
  const deduplicated: DnsRecord[] = [];

  for (const r of records) {
    const key = makeDnsRecordKey(r.type, r.name, r.value, r.priority);

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(r);
    }
  }

  return deduplicated;
}

/**
 * Deduplicate DNS records by value and priority only (for tooltip display).
 * Case-insensitive comparison for consistent deduplication.
 */
export function deduplicateDnsRecordsByValue(
  records: DnsRecord[],
): DnsRecord[] {
  const seen = new Set<string>();
  const deduplicated: DnsRecord[] = [];

  for (const r of records) {
    const key = `${r.value.trim().toLowerCase()}|${r.priority ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(r);
    }
  }

  return deduplicated;
}

/**
 * Sort DNS records for a specific type.
 * MX records are sorted by priority first, then alphabetically by value.
 * All other types are sorted alphabetically by value.
 */
export function sortDnsRecordsForType(
  records: DnsRecord[],
  type: DnsRecordType,
): DnsRecord[] {
  const sorted = [...records];

  if (type === "MX") {
    sorted.sort((a, b) => {
      const ap = a.priority ?? Number.MAX_SAFE_INTEGER;
      const bp = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.value.localeCompare(b.value);
    });
    return sorted;
  }

  sorted.sort((a, b) => a.value.localeCompare(b.value));
  return sorted;
}

/**
 * Sort DNS records by type order, then by type-specific sorting rules.
 * Used for consistent display ordering in API responses.
 */
export function sortDnsRecordsByType(
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

  for (const r of records) {
    byType[r.type].push(r);
  }

  const sorted: DnsRecord[] = [];
  for (const t of order) {
    sorted.push(...sortDnsRecordsForType(byType[t], t));
  }

  return sorted;
}
