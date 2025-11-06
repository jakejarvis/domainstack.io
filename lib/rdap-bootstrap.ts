import "server-only";

import type { BootstrapData } from "rdapper";
import { cache } from "react";
import { acquireLockOrWaitForResult } from "@/lib/cache";
import { RDAP_BOOTSTRAP_URL } from "@/lib/constants";
import { redis } from "@/lib/redis";

const CACHE_KEY = "rdap:bootstrap";
const LOCK_KEY = "rdap:bootstrap:lock";
const CACHE_TTL_SECONDS = 604800; // 1 week (bootstrap changes very infrequently)

/**
 * Fetch RDAP bootstrap data with Redis caching.
 *
 * The bootstrap registry changes infrequently (new TLDs, server updates),
 * so we cache it for 1 week in Redis with distributed locking to prevent thundering herd.
 *
 * This eliminates redundant fetches to IANA on every domain lookup when
 * passed to rdapper's lookup() via the customBootstrapData option.
 *
 * Also wrapped in React's cache() for per-request deduplication.
 *
 * @returns RDAP bootstrap data containing TLD-to-server mappings
 * @throws Error if fetch fails (caller should handle or let rdapper fetch directly)
 */
export const getRdapBootstrapData = cache(async (): Promise<BootstrapData> => {
  let bootstrap = await redis.get<BootstrapData>(CACHE_KEY);

  if (!bootstrap) {
    const lock = await acquireLockOrWaitForResult<BootstrapData>({
      lockKey: LOCK_KEY,
      resultKey: CACHE_KEY,
      lockTtl: 30,
      pollIntervalMs: 250,
      maxWaitMs: 20_000,
    });

    if (lock.acquired) {
      try {
        const res = await fetch(RDAP_BOOTSTRAP_URL);

        if (!res.ok) {
          throw new Error(
            `Failed to fetch RDAP bootstrap: ${res.status} ${res.statusText}`,
          );
        }

        bootstrap = await res.json();
        await redis.set(CACHE_KEY, bootstrap, {
          ex: CACHE_TTL_SECONDS,
        });
        console.info("[rdap-bootstrap] Bootstrap data fetched (not cached)");
      } catch (err) {
        console.error(
          "[rdap-bootstrap] fetch error",
          err instanceof Error ? err : new Error(String(err)),
        );
        // Write a short-TTL negative cache to prevent hammering during outages
        try {
          await redis.set(CACHE_KEY, null, { ex: 60 });
        } catch (cacheErr) {
          console.warn("[rdap-bootstrap] negative cache failed", cacheErr);
        }
        // Re-throw so rdapper can handle by fetching directly
        throw err;
      } finally {
        // Always release the lock so waiters don't stall
        try {
          await redis.del(LOCK_KEY);
        } catch (delErr) {
          console.warn("[rdap-bootstrap] lock release failed", delErr);
        }
      }
    } else {
      bootstrap = lock.cachedResult;
    }
  }

  if (!bootstrap) {
    throw new Error("RDAP bootstrap data unavailable");
  }

  return bootstrap;
});
