import { cache } from "react";
import { USER_AGENT } from "@/lib/constants/app";
import { ensureDomainRecord } from "@/lib/db/repos/domains";
import { getFaviconByDomain, upsertFavicon } from "@/lib/db/repos/favicons";
import { fetchRemoteAsset, RemoteAssetError } from "@/lib/fetch-remote-asset";
import { convertBufferToImageCover } from "@/lib/image";
import { createLogger } from "@/lib/logger/server";
import type { BlobUrlResponse } from "@/lib/schemas";
import { storeImage } from "@/lib/storage";
import { ttlForFavicon } from "@/lib/ttl";

const logger = createLogger({ source: "favicon" });

const DEFAULT_SIZE = 32;
const REQUEST_TIMEOUT_MS = 1500; // per each method
const MAX_FAVICON_BYTES = 1 * 1024 * 1024; // 1MB

// In-memory lock to prevent concurrent favicon generation for the same domain
const faviconPromises = new Map<string, Promise<{ url: string | null }>>();

// Safety timeout for cleaning up stale promises (30 seconds)
const PROMISE_CLEANUP_TIMEOUT_MS = 30_000;

function buildSources(domain: string): string[] {
  const enc = encodeURIComponent(domain);
  return [
    `https://icons.duckduckgo.com/ip3/${enc}.ico`,
    `https://www.google.com/s2/favicons?domain=${enc}&sz=${DEFAULT_SIZE}`,
    `https://${domain}/favicon.ico`,
    `http://${domain}/favicon.ico`,
  ];
}

/**
 * Internal function that does the actual work.
 */
async function fetchFaviconPromise(
  domain: string,
): Promise<{ url: string | null }> {
  // Check for in-flight request across all SSR contexts
  if (faviconPromises.has(domain)) {
    logger.debug("in-flight request hit", { domain });
    // biome-ignore lint/style/noNonNullAssertion: checked above
    return faviconPromises.get(domain)!;
  }

  // Create promise with guaranteed cleanup
  const promise = (async () => {
    try {
      return await fetchFavicon(domain);
    } finally {
      faviconPromises.delete(domain);
    }
  })();

  // Store promise with safety timeout cleanup
  faviconPromises.set(domain, promise);

  // Safety: Auto-cleanup stale promise after timeout
  const timeoutId = setTimeout(() => {
    if (faviconPromises.get(domain) === promise) {
      logger.warn("cleaning up stale promise", {
        domain,
        timeoutMs: PROMISE_CLEANUP_TIMEOUT_MS,
      });
      faviconPromises.delete(domain);
    }
  }, PROMISE_CLEANUP_TIMEOUT_MS);

  // Clear timeout when promise settles
  void promise.finally(() => clearTimeout(timeoutId));

  return promise;
}

/**
 * Core favicon fetching logic (separated for cleaner promise management)
 */
async function fetchFavicon(domain: string): Promise<{ url: string | null }> {
  // Check Postgres for cached favicon (optimized single query)
  try {
    const faviconRecord = await getFaviconByDomain(domain);
    if (faviconRecord) {
      // Only treat as cache hit if we have a definitive result:
      // - url is present (string), OR
      // - url is null but marked as permanently not found
      const isDefinitiveResult =
        faviconRecord.url !== null || faviconRecord.notFound === true;

      if (isDefinitiveResult) {
        logger.debug("db cache hit", { domain, cached: true });
        return { url: faviconRecord.url };
      }
    }
  } catch (err) {
    logger.error("db read failed", err, { domain });
  }

  // Generate favicon (cache missed)
  const sources = buildSources(domain);
  let allNotFound = true; // Track if all sources returned 404/not found

  for (const src of sources) {
    try {
      const asset = await fetchRemoteAsset({
        url: src,
        headers: {
          Accept: "image/avif,image/webp,image/png,image/*;q=0.9,*/*;q=0.8",
          "User-Agent": USER_AGENT,
        },
        maxBytes: MAX_FAVICON_BYTES,
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxRedirects: 2,
        allowHttp: src.startsWith("http://"),
      });
      allNotFound = false;
      const buf = asset.buffer;
      // Normalize everything to a consistent WebP size so we don't leak arbitrary formats downstream.
      const webp = await convertBufferToImageCover(
        buf,
        DEFAULT_SIZE,
        DEFAULT_SIZE,
        asset.contentType,
      );
      if (!webp) continue;
      const { url, pathname } = await storeImage({
        kind: "favicon",
        domain,
        buffer: webp,
        width: DEFAULT_SIZE,
        height: DEFAULT_SIZE,
      });
      const source = (() => {
        if (src.includes("icons.duckduckgo.com")) return "duckduckgo";
        if (src.includes("www.google.com/s2/favicons")) return "google";
        if (src.startsWith("https://")) return "direct_https";
        if (src.startsWith("http://")) return "direct_http";
        return "unknown";
      })();

      // Persist to Postgres
      try {
        const domainRecord = await ensureDomainRecord(domain);
        const now = new Date();
        const expiresAt = ttlForFavicon(now);

        await upsertFavicon({
          domainId: domainRecord.id,
          url,
          pathname: pathname ?? null,
          size: DEFAULT_SIZE,
          source,
          notFound: false,
          upstreamStatus: asset.status,
          upstreamContentType: asset.contentType ?? null,
          fetchedAt: now,
          expiresAt,
        });
      } catch (err) {
        logger.error("db persist error", err, { domain });
      }

      return { url };
    } catch (err) {
      if (
        err instanceof RemoteAssetError &&
        err.code === "response_error" &&
        err.status === 404
      ) {
        // still considered a true "not found"
      } else {
        allNotFound = false;
      }
      // Network error, timeout, etc. - not a true "not found"
      // try next source
    }
  }

  // All sources failed - persist null result with notFound flag if all were 404s
  try {
    const domainRecord = await ensureDomainRecord(domain);
    const now = new Date();
    const expiresAt = ttlForFavicon(now);

    await upsertFavicon({
      domainId: domainRecord.id,
      url: null,
      pathname: null,
      size: DEFAULT_SIZE,
      source: null,
      notFound: allNotFound,
      upstreamStatus: null,
      upstreamContentType: null,
      fetchedAt: now,
      expiresAt,
    });
  } catch (err) {
    logger.error("db persist error (null)", err, { domain });
  }

  return { url: null };
}

/**
 * Get or create a favicon for a domain.
 * Uses React's cache() for request-scoped deduplication - if multiple
 * components request the same favicon during SSR, only one fetch happens.
 */
export const getFavicon = cache(async function getFavicon(
  domain: string,
): Promise<BlobUrlResponse> {
  // Input domain is already normalized to registrable domain by router schema
  return fetchFaviconPromise(domain);
});
