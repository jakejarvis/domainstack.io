import { redis } from "@/lib/redis";

type CachedAssetOptions<TProduceMeta extends Record<string, unknown>> = {
  /**
   * Index key for the Redis cache
   */
  indexKey: string;
  /**
   * TTL in seconds for the Redis cache
   * @default 604800 (7 days)
   */
  ttlSeconds?: number;
  /**
   * Produce and upload the asset, returning { url, key } and any metrics to attach
   */
  produceAndUpload: () => Promise<{
    url: string | null;
    key?: string;
    notFound?: boolean; // true if asset permanently doesn't exist (don't retry)
    metrics?: TProduceMeta;
  }>;
};

/**
 * Get or create a cached asset (favicon, screenshot, social preview).
 *
 * Uses simple fail-open caching without distributed locks. If multiple requests
 * race to generate the same asset, they will all generate it and cache it.
 * This is acceptable because:
 * - Assets change infrequently (domains don't change favicons/screenshots often)
 * - Duplicate work is rare (only on concurrent cache misses)
 * - Blobs are automatically overwritten (deterministic pathnames)
 * - Simpler code with fewer failure modes
 */
export async function getOrCreateCachedAsset<T extends Record<string, unknown>>(
  options: CachedAssetOptions<T>,
): Promise<{ url: string | null }> {
  const {
    indexKey,
    ttlSeconds = 604800, // 7 days default
    produceAndUpload,
  } = options;

  // 1) Check cache first
  try {
    const raw = (await redis.get(indexKey)) as {
      url?: unknown;
      notFound?: unknown;
    } | null;
    if (raw && typeof raw === "object") {
      const cachedUrl = (raw as { url?: unknown }).url;
      const cachedNotFound = (raw as { notFound?: unknown }).notFound;

      if (typeof cachedUrl === "string") {
        return { url: cachedUrl };
      }
      // Only retry null if it's NOT marked as permanently not found
      if (cachedUrl === null && cachedNotFound === true) {
        // Permanent not found - don't retry
        return { url: null };
      }
    }
  } catch (err) {
    console.debug(
      `[cache] redis read failed ${indexKey}`,
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  // 2) Generate asset
  try {
    const produced = await produceAndUpload();
    const expiresAtMs = Date.now() + ttlSeconds * 1000;

    // Cache for next time (fire-and-forget)
    redis
      .set(
        indexKey,
        {
          url: produced.url,
          key: produced.key,
          notFound: produced.notFound ?? undefined,
          expiresAtMs,
        },
        { ex: ttlSeconds },
      )
      .catch(() => {});

    return { url: produced.url };
  } catch (produceErr) {
    console.error(
      `[cache] asset generation failed ${indexKey}`,
      produceErr instanceof Error ? produceErr : new Error(String(produceErr)),
    );
    throw produceErr;
  }
}
