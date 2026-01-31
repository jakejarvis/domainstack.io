/**
 * TLS certificate types.
 */

/**
 * Raw certificate data from TLS handshake.
 */
export interface RawCertificate {
  issuer: string;
  subject: string;
  altNames: string[];
  validFrom: string;
  validTo: string;
}

/**
 * TLS fetch success result.
 */
export interface TlsFetchSuccess {
  success: true;
  chain: RawCertificate[];
}

/**
 * TLS fetch failure result.
 */
export interface TlsFetchFailure {
  success: false;
  error: "dns_error" | "tls_error" | "timeout" | "fetch_error";
}

/**
 * Result of fetching TLS certificates.
 */
export type TlsFetchResult = TlsFetchSuccess | TlsFetchFailure;

/**
 * Options for TLS certificate fetching.
 */
export interface TlsFetchOptions {
  /** Timeout in milliseconds for the TLS handshake (default: 6000) */
  timeoutMs?: number;
  /** Port to connect to (default: 443) */
  port?: number;
}
