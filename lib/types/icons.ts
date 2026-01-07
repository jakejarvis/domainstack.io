/**
 * Icon types - Plain TypeScript interfaces.
 *
 * These are configuration types for icon fetching,
 * no runtime validation needed.
 */

/**
 * A source for fetching icons.
 */
export interface IconSource {
  url: string;
  /** Source identifier for logging (e.g., "duckduckgo", "logo_dev") */
  name: string;
  /** Optional custom headers for this source */
  headers?: Record<string, string>;
  /** Allow HTTP (default: false) */
  allowHttp?: boolean;
}

/**
 * Cached icon record from database.
 */
export interface CachedIconRecord {
  url: string | null;
  notFound?: boolean;
}

/**
 * Configuration for fetching an icon (without function callbacks).
 */
export interface FetchIconConfigBase {
  /** Unique identifier for deduplication (e.g., domain, providerId) */
  identifier: string;
  /** Kind of blob for storage (e.g., "favicon", "provider-logo") */
  blobKind: "favicon" | "provider-logo";
  /** Domain for blob storage path */
  blobDomain: string;
  /** Sources to try in order (first success wins) */
  sources: IconSource[];
  /** Icon size in pixels (default: 32) */
  size?: number;
  /** Request timeout per source in ms (default: 1500) */
  timeoutMs?: number;
  /** Max icon size in bytes (default: 1MB) */
  maxBytes?: number;
}

/**
 * Full configuration for fetching an icon, including callbacks.
 */
export interface FetchIconConfig extends FetchIconConfigBase {
  /** Function to check cache */
  getCachedRecord: () => Promise<CachedIconRecord | null>;
  /** Function to persist to database */
  persistRecord: (data: {
    url: string | null;
    pathname: string | null;
    size: number;
    source: string | null;
    notFound: boolean;
    upstreamStatus?: number | null;
    upstreamContentType?: string | null;
    fetchedAt: Date;
    expiresAt: Date;
  }) => Promise<void>;
  /** TTL calculator */
  ttlFn: (now: Date) => Date;
}
