/**
 * WHOIS/RDAP types.
 */

/**
 * RDAP lookup success result.
 */
export interface RdapLookupSuccess {
  success: true;
  recordJson: string;
}

/**
 * RDAP lookup failure result.
 */
export interface RdapLookupFailure {
  success: false;
  error: "unsupported_tld" | "timeout" | "retry" | "not_found";
}

/**
 * Result of an RDAP lookup.
 */
export type RdapLookupResult = RdapLookupSuccess | RdapLookupFailure;

/**
 * Options for WHOIS/RDAP lookup.
 */
export interface WhoisLookupOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
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
