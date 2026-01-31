/**
 * DNS fetch types.
 *
 * Shared types for DNS fetching operations.
 */

import type { DnsRecord } from "@domainstack/types";

/**
 * Record with expiry metadata for persistence.
 */
export interface DnsRecordWithExpiry {
  type: string;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
  isCloudflare?: boolean;
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
