/**
 * DNS types - Plain TypeScript interfaces.
 */

import type { DnsRecordType } from "../primitives";

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
  /**
   * Internal id of the looked-up hostname's `domains` row, once persisted.
   * Used for screenshot API requests, which are keyed by the hostname's own row.
   */
  domainId?: string;
}
