/**
 * DNS-over-HTTPS (DoH) types.
 */

/**
 * DNS answer from DoH JSON response.
 */
export interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

/**
 * DoH JSON response format (RFC 8427).
 */
export interface DnsJson {
  Status: number;
  /** Authenticated Data: the resolver DNSSEC-validated the answer. */
  AD?: boolean;
  Answer?: DnsAnswer[];
}

/**
 * Options for DoH queries.
 */
export interface DohQueryOptions {
  /** Add timestamp parameter to bypass HTTP caches (useful for verification) */
  cacheBust?: boolean;
  /** Request timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Set the DO bit so the resolver validates DNSSEC and returns the AD flag. */
  dnssec?: boolean;
  /** Set the CD bit: resolve even if DNSSEC validation fails (bogus answers). */
  checkingDisabled?: boolean;
}

/**
 * Raw outcome of a DoH query, before RCODE interpretation.
 */
export interface DohResult {
  /** DNS RCODE (0 NOERROR, 2 SERVFAIL, 3 NXDOMAIN, …). */
  rcode: number;
  /** The resolver set the AD (authenticated data) flag. */
  ad: boolean;
  answers: DnsAnswer[];
}
