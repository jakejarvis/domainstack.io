/**
 * Icon types - Plain TypeScript interfaces.
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
 * Configuration for fetching an icon.
 */
export interface FetchIconConfig {
  /** Unique identifier for deduplication (e.g., domain, providerId) */
  identifier: string;
  /** Kind of blob for storage */
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
  /** Function to check cache */
  getCachedRecord: () => Promise<{
    url: string | null;
    notFound?: boolean;
  } | null>;
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
