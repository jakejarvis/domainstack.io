import "server-only";

import { fetchRemoteAsset } from "@/lib/fetch-remote-asset";
import { convertBufferToImageCover } from "@/lib/image";
import { createLogger } from "@/lib/logger/server";
import type { FetchIconConfig } from "@/lib/schemas";
import { storeImage } from "@/lib/storage";

const logger = createLogger({ source: "icon-pipeline" });

// In-memory lock to prevent concurrent icon generation
const iconPromises = new Map<string, Promise<{ url: string | null }>>();

// Safety timeout for cleaning up stale promises (30 seconds)
const PROMISE_CLEANUP_TIMEOUT_MS = 30_000;

const DEFAULT_SIZE = 32;
const REQUEST_TIMEOUT_MS = 1500;
const MAX_ICON_BYTES = 1 * 1024 * 1024; // 1MB

/**
 * Core icon fetching logic (separated for cleaner promise management)
 */
async function processIconImpl(
  config: FetchIconConfig,
): Promise<{ url: string | null }> {
  const {
    blobKind,
    blobDomain,
    sources,
    getCachedRecord,
    persistRecord,
    ttlFn,
    logContext = {},
    size = DEFAULT_SIZE,
    timeoutMs = REQUEST_TIMEOUT_MS,
    maxBytes = MAX_ICON_BYTES,
  } = config;

  // Check cache for existing record
  try {
    const cachedRecord = await getCachedRecord();
    if (cachedRecord) {
      // Only treat as cache hit if we have a definitive result:
      // - url is present (string), OR
      // - url is null but marked as permanently not found
      const isDefinitiveResult =
        cachedRecord.url !== null || cachedRecord.notFound === true;

      if (isDefinitiveResult) {
        logger.debug("db cache hit", { ...logContext });
        return { url: cachedRecord.url };
      }
    }
  } catch (err) {
    logger.error("db read failed", err, { ...logContext });
  }

  // Generate icon (cache missed)
  let allNotFound = true; // Track if all sources returned 404/not found

  for (const source of sources) {
    try {
      const headers = {
        Accept: "image/avif,image/webp,image/png,image/*;q=0.9,*/*;q=0.8",
        ...source.headers,
      };

      const asset = await fetchRemoteAsset({
        url: source.url,
        headers,
        maxBytes,
        timeoutMs,
        maxRedirects: 2,
        allowHttp: source.allowHttp ?? false,
      });

      // Handle non-OK responses
      if (!asset.ok) {
        // 404 is still considered a true "not found", other errors are not
        if (asset.status !== 404) {
          allNotFound = false;
        }
        continue; // Try next source
      }

      allNotFound = false;
      const buf = asset.buffer;

      // Normalize everything to a consistent WebP size
      const webp = await convertBufferToImageCover(
        buf,
        size,
        size,
        asset.contentType,
      );
      if (!webp) continue;

      const { url, pathname } = await storeImage({
        kind: blobKind,
        domain: blobDomain,
        buffer: webp,
        width: size,
        height: size,
      });

      // Persist to database
      try {
        const now = new Date();
        const expiresAt = ttlFn(now);

        await persistRecord({
          url,
          pathname: pathname ?? null,
          size,
          source: source.name,
          notFound: false,
          upstreamStatus: asset.status,
          upstreamContentType: asset.contentType ?? null,
          fetchedAt: now,
          expiresAt,
        });
      } catch (err) {
        logger.error("db persist error", err, { ...logContext });
      }

      return { url };
    } catch {
      // Infrastructure errors (DNS, private IP, etc.) - not a true "not found"
      allNotFound = false;
      // Try next source
    }
  }

  // All sources failed - persist null result with notFound flag if all were 404s
  try {
    const now = new Date();
    const expiresAt = ttlFn(now);

    await persistRecord({
      url: null,
      pathname: null,
      size,
      source: null,
      notFound: allNotFound,
      upstreamStatus: null,
      upstreamContentType: null,
      fetchedAt: now,
      expiresAt,
    });
  } catch (err) {
    logger.error("db persist error (null)", err, { ...logContext });
  }

  return { url: null };
}

/**
 * Fetch a remote icon with caching, fallback sources, and deduplication.
 * Handles the complete flow: cache check → fetch → convert → store → persist.
 */
export async function processIcon(
  config: FetchIconConfig,
): Promise<{ url: string | null }> {
  const { identifier, logContext = {} } = config;

  // Check for in-flight request
  if (iconPromises.has(identifier)) {
    logger.debug("in-flight request hit", { ...logContext });
    // biome-ignore lint/style/noNonNullAssertion: checked above
    return iconPromises.get(identifier)!;
  }

  // Create promise with guaranteed cleanup
  const promise = (async () => {
    try {
      return await processIconImpl(config);
    } finally {
      iconPromises.delete(identifier);
    }
  })();

  // Store promise with safety timeout cleanup
  iconPromises.set(identifier, promise);

  // Safety: Auto-cleanup stale promise after timeout
  const timeoutId = setTimeout(() => {
    if (iconPromises.get(identifier) === promise) {
      logger.warn("cleaning up stale promise", {
        ...logContext,
        timeoutMs: PROMISE_CLEANUP_TIMEOUT_MS,
      });
      iconPromises.delete(identifier);
    }
  }, PROMISE_CLEANUP_TIMEOUT_MS);

  // Clear timeout when promise settles
  void promise.finally(() => clearTimeout(timeoutId));

  return promise;
}
