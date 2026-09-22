/**
 * DNS fetch types.
 *
 * Shared types for DNS fetching operations.
 */

import type { DnsRecord, DnssecResult } from "@domainstack/types";

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
  /** DNSSEC status observed by the same provider; `registry` is filled in at response time. */
  dnssec: DnssecResult;
  /** ISO timestamp after which `dnssec` should be refetched. */
  dnssecExpiresAt: string;
  /** Whether `dnssec.ds`/`dnssec.dnskeys` are a real observation this round (see `DnssecFetchData`). */
  dnssecDsAvailable: boolean;
  dnssecDnskeysAvailable: boolean;
}
