/**
 * DNS types - Plain TypeScript interfaces.
 */

import type { DNS_RECORD_TYPES } from "@/lib/constants/dns";

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

/**
 * Alias for DnsRecordType (used in workflows).
 */
export type DnsType = DnsRecordType;

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
