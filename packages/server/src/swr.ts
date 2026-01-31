/**
 * Generic stale-while-revalidate cache helper.
 *
 * No workflow SDK dependency - works with any async function.
 */

import type { CacheResult } from "@domainstack/db";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "swr" });

export type { CacheResult };

/**
 * Result type for SWR operations.
 */
export type SwrResult<T> =
  | {
      success: true;
      /** True if data came from cache (fresh or stale) */
      cached: boolean;
      /** True if data is expired but returned anyway (background revalidation triggered) */
      stale: boolean;
      data: T;
    }
  | {
      success: false;
      cached: false;
      stale: false;
      data: null;
      error: string;
    };

/**
 * Options for the withSwr helper.
 */
export interface SwrOptions<T, E extends string = string> {
  /**
   * Name for logging (e.g., "registration", "dns").
   */
  name: string;

  /**
   * The domain being queried.
   */
  domain: string;

  /**
   * Function to check the cache.
   */
  getCached: () => Promise<CacheResult<T>>;

  /**
   * Function to fetch fresh data.
   * Should throw on transient errors (for TanStack Query to retry).
   * Should return { success: false, error } on permanent errors.
   */
  fetchFresh: () => Promise<
    { success: true; data: T } | { success: false; error: E }
  >;

  /**
   * Maximum age of data in milliseconds before it's considered too stale.
   * If data was fetched longer than this ago, wait for fresh data instead
   * of returning stale data.
   *
   * If not set, stale data is always returned with background revalidation.
   */
  maxAgeMs?: number;
}

/**
 * Stale-while-revalidate cache helper.
 *
 * - If data is fresh: return immediately
 * - If data is stale but within maxAgeMs: return stale + background refresh
 * - If data is stale and exceeds maxAgeMs: wait for fresh data
 * - If no data: fetch fresh and wait for result
 *
 * @example
 * ```ts
 * const result = await withSwr({
 *   name: "registration",
 *   domain: "example.com",
 *   getCached: () => getCachedRegistration("example.com"),
 *   fetchFresh: () => fetchRegistration("example.com", { catalog }),
 *   maxAgeMs: 24 * 60 * 60 * 1000,
 * });
 * ```
 */
export async function withSwr<T, E extends string = string>(
  options: SwrOptions<T, E>,
): Promise<SwrResult<T>> {
  const { name, domain, getCached, fetchFresh, maxAgeMs } = options;

  // 1. Check cache
  const cached = await getCached();

  // 2. Fresh data - return immediately
  if (cached.data && !cached.stale) {
    return { success: true, cached: true, stale: false, data: cached.data };
  }

  // 3. Stale data - check if acceptable
  if (cached.data && cached.stale) {
    const isTooOld =
      maxAgeMs !== undefined &&
      cached.fetchedAt !== null &&
      Date.now() - cached.fetchedAt.getTime() > maxAgeMs;

    if (!isTooOld) {
      // Return stale, trigger background refresh (fire-and-forget)
      fetchFresh().catch((err: unknown) => {
        logger.error({ name, domain, err }, "background refresh failed");
      });
      return { success: true, cached: true, stale: true, data: cached.data };
    }
    // Too old - fall through to fetch fresh
  }

  // 4. Cache miss or too stale - fetch fresh and wait
  const result = await fetchFresh();

  if (result.success === false) {
    return {
      success: false,
      cached: false,
      stale: false,
      data: null,
      error: result.error,
    };
  }

  return { success: true, cached: false, stale: false, data: result.data };
}
