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
  fingerprint256: string;
  serialNumber: string;
  /** Zero-based position in the presented chain. The leaf is always `0`. */
  chainPosition: number;
}

/**
 * TLS fetch success result.
 *
 * Retrieval and validation are separate: an expired or otherwise untrusted
 * certificate still returns its chain with `valid: false`.
 */
export interface TlsFetchSuccess {
  success: true;
  chain: RawCertificate[];
  valid: boolean;
  validationError: string | null;
  protocol: string | null;
  cipher: string | null;
  publicKeyBits: number | null;
  chainComplete: boolean;
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
