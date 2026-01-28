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
  Answer?: DnsAnswer[];
}

/**
 * Options for DoH queries.
 */
export interface DohQueryOptions {
  /** Add timestamp parameter to bypass HTTP caches (useful for verification) */
  cacheBust?: boolean;
}
