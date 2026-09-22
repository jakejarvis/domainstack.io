/**
 * DNS types - Plain TypeScript interfaces.
 */

import type { PendingChangeObservation } from "../monitoring";
import type { DnsRecordType, DnssecStatus } from "../primitives";

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
  /** Absent on payloads cached before DNSSEC tracking existed. */
  dnssec?: DnssecResult;
}

/**
 * DNSSEC validation result for a domain.
 */
export interface DnssecResult {
  status: DnssecStatus;
  /** DS records published at the parent zone (the delegation's chain-of-trust anchors). */
  ds: DnssecDsRecord[];
  /** DNSKEY records published in the zone itself. */
  dnskeys: DnssecKey[];
  /**
   * Present and `false` when `dnskeys` is a stand-in for a query that failed
   * independently of `status` (e.g. the DNSKEY lookup errored while the SOA
   * query still classified the zone) rather than a confirmed-empty set.
   * Absent otherwise — including on payloads cached before this existed.
   */
  dnskeysAvailable?: false;
  /** Cross-check against registry (RDAP) data; absent when no registration data is known. */
  registry?: DnssecRegistryCheck;
}

/**
 * DNSSEC snapshot data stored on `domain_snapshots.dnssec`. `indeterminate` is
 * never stored: it means the state could not be observed.
 */
export interface DnssecSnapshotData {
  status: Exclude<DnssecStatus, "indeterminate">;
  /** Unconfirmed change awaiting a repeat observation (see confirmChange). */
  pending?: PendingChangeObservation | null;
}

export interface DnssecDsRecord {
  keyTag: number;
  algorithm: number;
  digestType: number;
  digest: string;
}

export interface DnssecKey {
  flags: number;
  protocol: number;
  algorithm: number;
  /** Key-signing key (flags bit 0 / SEP). */
  isKsk: boolean;
}

export type DnssecRegistryMismatchReason =
  | "ds_missing_in_dns"
  | "ds_missing_at_registry"
  | "ds_differs";

export interface DnssecRegistryCheck {
  /** Whether the registry reports the delegation as signed. */
  enabled: boolean;
  mismatch: boolean;
  reason?: DnssecRegistryMismatchReason;
}
