/**
 * Minimal logger interface for safe-fetch.
 * Compatible with pino, console, and custom loggers.
 */
export interface SafeFetchLogger {
  debug: (obj: Record<string, unknown>, msg: string) => void;
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

/**
 * Options for safeFetch.
 */
export interface SafeFetchOptions {
  /** URL to fetch (absolute, or relative if currentUrl is provided) */
  url: string | URL;

  /** User-Agent header (optional) */
  userAgent: string | null | undefined;

  /** Base URL for resolving relative URLs */
  currentUrl?: string | URL;

  /** HTTP method (default: "GET") */
  method?: "GET" | "HEAD";

  /** Additional headers */
  headers?: Record<string, string>;

  /** Timeout per request in ms (default: 8000) */
  timeoutMs?: number;

  /** Max response size in bytes (default: 15MB) */
  maxBytes?: number;

  /** Max redirects to follow (default: 3) */
  maxRedirects?: number;

  /** Allow HTTP URLs (default: false, HTTPS only) */
  allowHttp?: boolean;

  /** If true, return truncated content instead of throwing on size limit (default: false) */
  truncateOnLimit?: boolean;

  /** Retry with GET if HEAD returns 405 (default: false) */
  fallbackToGetOnHeadFailure?: boolean;

  /** Host allowlist - if set, only these hosts are allowed */
  allowedHosts?: string[];

  /** Return 3xx response instead of throwing if redirect goes to disallowed host */
  returnOnDisallowedRedirect?: boolean;

  /**
   * Custom fetch function (default: globalThis.fetch).
   * Useful for Next.js caching: `fetch: (url, init) => fetch(url, { ...init, next: { revalidate: 3600 } })`
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Optional logger for debugging and monitoring.
   */
  logger?: SafeFetchLogger;
}

/**
 * Result from safeFetch.
 */
export interface SafeFetchResult {
  /** Response body as Buffer */
  buffer: Buffer;

  /** Content-Type header value */
  contentType: string | null;

  /** Final URL after redirects */
  finalUrl: string;

  /** HTTP status code */
  status: number;

  /** True if status is 2xx */
  ok: boolean;

  /** All response headers */
  headers: Record<string, string>;
}
