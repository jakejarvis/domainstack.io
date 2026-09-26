/**
 * WHOIS/RDAP types.
 */

import type { LookupAttempt, LookupErrorCode } from "rdapper";

/**
 * RDAP lookup success result.
 */
export interface RdapLookupSuccess {
  success: true;
  recordJson: string;
}

/**
 * Why a lookup failed, straight from rdapper. `attempts` traces every network
 * operation (including failures recovered by fallback), so a timeout can be
 * pinned to a specific phase and server.
 */
interface RdapLookupFailureDetail {
  message?: string;
  code?: LookupErrorCode;
  phase?: LookupAttempt["phase"];
  server?: string;
  /** Server-requested back-off in ms, when an RDAP `Retry-After` was the terminal failure */
  retryAfterMs?: number;
  attempts: LookupAttempt[];
}

/**
 * RDAP lookup failure result.
 */
export interface RdapLookupFailure {
  success: false;
  error: "unsupported_tld" | "timeout" | "retry";
  detail: RdapLookupFailureDetail;
}

/**
 * Result of an RDAP lookup.
 */
export type RdapLookupResult = RdapLookupSuccess | RdapLookupFailure;

/**
 * Options for WHOIS/RDAP lookup.
 */
export interface WhoisLookupOptions {
  /** Timeout per network operation in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Overall deadline for the whole lookup in milliseconds (default: 10000) */
  deadlineMs?: number;
  /** Include raw WHOIS response (default: true) */
  includeRaw?: boolean;
  /** Custom bootstrap data for RDAP (optional) */
  customBootstrapData?: unknown;
  /** User agent for requests */
  userAgent?: string;
}

/**
 * RDAP Bootstrap data URL from IANA.
 */
export const RDAP_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
