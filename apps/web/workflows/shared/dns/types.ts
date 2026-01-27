/**
 * DNS shared step types.
 *
 * Internal types for step-to-step data transfer and typed errors.
 * Response types (DnsRecordsResponse) remain in lib/types/domain/dns.ts.
 */

import type { DnsRecord } from "@domainstack/types";

/**
 * Internal data structure for step-to-step transfer.
 * Includes expiry metadata not exposed in the public response.
 */
export interface DnsFetchData {
  records: DnsRecord[];
  resolver: string;
  recordsWithExpiry: Array<{
    type: string;
    name: string;
    value: string;
    ttl?: number;
    priority?: number;
    isCloudflare?: boolean;
    expiresAt: string;
  }>;
}

/**
 * Result of the DNS fetch step.
 * DNS always succeeds or throws RetryableError - there are no permanent failures.
 */
export type FetchDnsResult = { success: true; data: DnsFetchData };
