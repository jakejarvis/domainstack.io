import { after } from "next/server";
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
  /**
   * Optional: Fetch cached asset from database (L2 cache)
   */
  fetchFromDb?: () => Promise<{
    url: string | null;
    key?: string;
    notFound?: boolean;
  } | null>;
  /**
   * Optional: Persist generated asset to database
   */
  persistToDb?: (result: {
    url: string | null;
    key?: string;
    notFound?: boolean;
    metrics?: TProduceMeta;
  }) => Promise<void>;
};

/**
 * Get or create a cached asset (favicon, screenshot, social preview).
 *
 * Caching strategy with optional DB persistence:
 * 1. Check Redis (L1 cache) - fastest
 * 2. Check Postgres (L2 cache) if fetchFromDb provided - persistent
 * 3. Generate asset if both miss
 * 4. Persist to Postgres if persistToDb provided
 * 5. Cache in Redis for next time
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
    fetchFromDb,
    persistToDb,
  } = options;

  // 1) Check Redis cache first (L1)
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

  // 2) Check Postgres cache if available (L2)
  if (fetchFromDb) {
    try {
      const dbResult = await fetchFromDb();
      if (dbResult) {
        // Found in DB, cache it in Redis for next time
        after(() => {
          const expiresAtMs = Date.now() + ttlSeconds * 1000;
          redis
            .set(
              indexKey,
              {
                url: dbResult.url,
                key: dbResult.key,
                notFound: dbResult.notFound ?? undefined,
                expiresAtMs,
              },
              { ex: ttlSeconds },
            )
            .catch((err) => {
              console.error(
                "[cache] redis write from db failed",
                { indexKey },
                err instanceof Error ? err : new Error(String(err)),
              );
            });
        });

        console.debug(`[cache] db hit ${indexKey}`);
        return { url: dbResult.url };
      }
    } catch (err) {
      // DB failures should not break the flow; log and fall through to generation
      console.warn(
        `[cache] db read failed ${indexKey}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  // 3) Generate asset (both caches missed or failed)
  try {
    const produced = await produceAndUpload();
    const expiresAtMs = Date.now() + ttlSeconds * 1000;

    // 4) Persist to Postgres if callback provided
    if (persistToDb) {
      after(() => {
        persistToDb({
          url: produced.url,
          key: produced.key,
          notFound: produced.notFound,
          metrics: produced.metrics,
        }).catch((err) => {
          console.error(
            "[cache] db persist error",
            { indexKey },
            err instanceof Error ? err : new Error(String(err)),
          );
        });
      });
    }

    // 5) Cache in Redis for next time
    after(() => {
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
        .catch((err) => {
          console.error(
            "[cache] cache write error",
            { indexKey },
            err instanceof Error ? err : new Error(String(err)),
          );
        });
    });

    return { url: produced.url };
  } catch (produceErr) {
    console.error(
      `[cache] asset generation failed ${indexKey}`,
      produceErr instanceof Error ? produceErr : new Error(String(produceErr)),
    );
    throw produceErr;
  }
}
