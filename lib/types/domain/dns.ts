/**
 * DNS types - Plain TypeScript interfaces.
 */

import { DNS_RECORD_TYPES, type DnsRecordType } from "../primitives";

/**
 * Alias for DnsRecordType (used in workflows).
 */
export type DnsType = DnsRecordType;

/**
 * Array of DNS record types (for iteration).
 */
export const DNS_TYPES = DNS_RECORD_TYPES;

/**
 * A single DNS record.
 */
export interface DnsRecord {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
  isCloudflare?: boolean;
}

/**
 * Response from DNS resolution.
 */
export interface DnsRecordsResponse {
  records: DnsRecord[];
  resolver: string | null;
}
