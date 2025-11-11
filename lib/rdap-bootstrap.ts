import "server-only";

import type { BootstrapData } from "rdapper";
import { cache } from "react";
import {
  RDAP_BOOTSTRAP_CACHE_TTL_SECONDS,
  RDAP_BOOTSTRAP_URL,
} from "@/lib/constants";
import { redis } from "@/lib/redis";

const CACHE_KEY = "rdap:bootstrap";

/**
 * Fetch RDAP bootstrap data with Redis caching.
 *
 * The bootstrap registry changes infrequently (new TLDs, server updates),
 * so we cache it for 1 week in Redis. If multiple requests race to fetch, they will
 * all get the same data and cache it (acceptable for rarely-changing data).
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
  // Try Redis cache first
  const cached = await redis.get<BootstrapData>(CACHE_KEY).catch(() => null);
  if (cached) return cached;

  // Fetch from IANA
  try {
    const res = await fetch(RDAP_BOOTSTRAP_URL);

    if (!res.ok) {
      throw new Error(
        `Failed to fetch RDAP bootstrap: ${res.status} ${res.statusText}`,
      );
    }

    const bootstrap = await res.json();

    // Cache for next time (fire-and-forget)
    redis
      .set(CACHE_KEY, bootstrap, { ex: RDAP_BOOTSTRAP_CACHE_TTL_SECONDS })
      .catch(() => {});

    console.info("[rdap-bootstrap] Bootstrap data fetched (not cached)");
    return bootstrap;
  } catch (err) {
    console.error(
      "[rdap-bootstrap] fetch error",
      err instanceof Error ? err : new Error(String(err)),
    );
    // Re-throw so rdapper can handle by fetching directly
    throw err;
  }
});
