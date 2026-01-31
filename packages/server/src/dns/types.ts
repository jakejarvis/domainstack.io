/**
 * DNS fetch types.
 *
 * Shared types for DNS fetching operations.
 */

import type { DnsRecord } from "@domainstack/types";

/**
 * Record with expiry metadata for persistence.
 * Extends DnsRecord with expiration timestamp.
 */
export interface DnsRecordWithExpiry extends DnsRecord {
  expiresAt: string;
}

/**
 * Result of DNS fetching operation.
 */
export interface DnsFetchData {
  records: DnsRecord[];
  resolver: string;
  recordsWithExpiry: DnsRecordWithExpiry[];
}
