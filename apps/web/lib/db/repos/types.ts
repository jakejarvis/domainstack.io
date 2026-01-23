/**
 * Cache result type for stale-while-revalidate pattern.
 * Used by repo functions to return data with staleness metadata.
 */
export interface CacheResult<T> {
  /** The cached data, or null if no data exists */
  data: T | null;
  /** True if the data exists but has expired */
  stale: boolean;
  /** When the data was originally fetched, or null if no data */
  fetchedAt: Date | null;
  /** When the cache entry expires/expired, or null if no data */
  expiresAt: Date | null;
}
