export interface FaviconWorkflowInput {
  domain: string;
}

export interface FaviconWorkflowResult {
  success: boolean;
  cached: boolean;
  data: { url: string | null };
}

// Internal types for fetch result - serializable for step-to-step transfer
interface FetchSuccess {
  success: true;
  // Base64-encoded image buffer for serialization
  imageBase64: string;
  contentType: string | null;
  sourceName: string;
}

interface FetchFailure {
  success: false;
  allNotFound: boolean;
}

type FetchResult = FetchSuccess | FetchFailure;

const DEFAULT_SIZE = 32;

/**
 * Durable favicon workflow that breaks down icon fetching into
 * independently retryable steps:
 * 1. Check cache (Postgres)
 * 2. Fetch from multiple sources with fallbacks
 * 3. Process image (convert to WebP)
 * 4. Store to Vercel Blob and persist to database
 */
export async function faviconWorkflow(
  input: FaviconWorkflowInput,
): Promise<FaviconWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Check Postgres cache
  const cachedResult = await checkCache(domain);

  if (cachedResult.found) {
    return {
      success: true,
      cached: true,
      data: cachedResult.data,
    };
  }

  // Step 2: Fetch from sources
  const fetchResult = await fetchFromSources(domain);

  if (!fetchResult.success) {
    // Step 3a: Persist failure
    await persistFailure(domain, fetchResult.allNotFound);

    return {
      success: true,
      cached: false,
      data: { url: null },
    };
  }

  // Step 3b: Process image
  const processedResult = await processImage(fetchResult.imageBase64);

  if (!processedResult.success) {
    // Image processing failed
    await persistFailure(domain, false);
    return {
      success: false,
      cached: false,
      data: { url: null },
    };
  }

  // Step 4: Store and persist
  const storeResult = await storeAndPersist(
    domain,
    processedResult.imageBase64,
    fetchResult.sourceName,
  );

  return {
    success: true,
    cached: false,
    data: { url: storeResult.url },
  };
}

/**
 * Step: Check Postgres cache for existing favicon
 */
async function checkCache(
  domain: string,
): Promise<
  | { found: true; data: { url: string | null; notFound: boolean } }
  | { found: false }
> {
  "use step";

  const { getFaviconByDomain } = await import("@/lib/db/repos/favicons");

  try {
    const cachedRecord = await getFaviconByDomain(domain);

    if (cachedRecord) {
      // Only treat as cache hit if we have a definitive result:
      // - url is present (string), OR
      // - url is null but marked as permanently not found
      const isDefinitiveResult =
        cachedRecord.url !== null || cachedRecord.notFound === true;

      if (isDefinitiveResult) {
        return {
          found: true,
          data: {
            url: cachedRecord.url,
            notFound: cachedRecord.notFound,
          },
        };
      }
    }

    return { found: false };
  } catch {
    // Cache check failed, fall through to fetch
    return { found: false };
  }
}
/**
 * Step: Fetch favicon from multiple sources with fallbacks
 * This is a potentially slow operation with multiple HTTP requests.
 */
async function fetchFromSources(domain: string): Promise<FetchResult> {
  "use step";

  const { buildIconSources } = await import("@/lib/icons/sources");
  const { fetchRemoteAsset, RemoteAssetError } = await import(
    "@/lib/fetch-remote-asset"
  );
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "favicon-workflow" });
  const sources = buildIconSources(domain, { size: DEFAULT_SIZE });

  let allNotFound = true;

  for (const source of sources) {
    try {
      const headers = {
        Accept: "image/avif,image/webp,image/png,image/*;q=0.9,*/*;q=0.8",
        ...source.headers,
      };

      const asset = await fetchRemoteAsset({
        url: source.url,
        headers,
        maxBytes: 1 * 1024 * 1024, // 1MB
        timeoutMs: 1500,
        maxRedirects: 2,
        allowHttp: source.allowHttp ?? false,
      });

      if (!asset.ok) {
        // 404 is still considered a true "not found", other errors are not
        if (asset.status !== 404) {
          allNotFound = false;
        }
        continue;
      }

      allNotFound = false;

      // Encode buffer as base64 for serialization
      return {
        success: true,
        imageBase64: asset.buffer.toString("base64"),
        contentType: asset.contentType ?? null,
        sourceName: source.name,
      };
    } catch (err) {
      if (!(err instanceof RemoteAssetError)) {
        logger.warn({ err, domain, source: source.name }, "fetch failed");
      }
      // Infrastructure errors are not "not found"
      allNotFound = false;
    }
  }

  return { success: false, allNotFound };
}

/**
 * Step: Process and convert image to WebP
 */
async function processImage(
  imageBase64: string,
): Promise<{ success: true; imageBase64: string } | { success: false }> {
  "use step";

  const { convertBufferToImageCover } = await import("@/lib/image");

  try {
    const buffer = Buffer.from(imageBase64, "base64");

    const webp = await convertBufferToImageCover(
      buffer,
      DEFAULT_SIZE,
      DEFAULT_SIZE,
      null, // contentType - let sharp detect
    );

    if (!webp || webp.length === 0) {
      return { success: false };
    }

    return {
      success: true,
      imageBase64: webp.toString("base64"),
    };
  } catch {
    return { success: false };
  }
}

/**
 * Step: Store to Vercel Blob and persist to database
 */
async function storeAndPersist(
  domain: string,
  imageBase64: string,
  sourceName: string,
): Promise<{ url: string }> {
  "use step";

  const { storeImage } = await import("@/lib/storage");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertFavicon } = await import("@/lib/db/repos/favicons");
  const { ttlForFavicon } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "favicon-workflow" });
  const buffer = Buffer.from(imageBase64, "base64");

  try {
    // Store to Vercel Blob
    const { url, pathname } = await storeImage({
      kind: "favicon",
      domain,
      buffer,
      width: DEFAULT_SIZE,
      height: DEFAULT_SIZE,
    });

    // Persist to database
    const domainRecord = await ensureDomainRecord(domain);
    const now = new Date();
    const expiresAt = ttlForFavicon(now);

    await upsertFavicon({
      domainId: domainRecord.id,
      url,
      pathname: pathname ?? null,
      size: DEFAULT_SIZE,
      source: sourceName,
      notFound: false,
      upstreamStatus: 200,
      upstreamContentType: "image/webp",
      fetchedAt: now,
      expiresAt,
    });

    logger.debug({ domain }, "favicon stored and persisted");

    return { url };
  } catch (err) {
    logger.error({ err, domain }, "failed to store favicon");
    throw err; // Re-throw so workflow can retry
  }
}

/**
 * Step: Persist failure to database cache
 */
async function persistFailure(
  domain: string,
  isNotFound: boolean,
): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertFavicon } = await import("@/lib/db/repos/favicons");
  const { ttlForFavicon } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "favicon-workflow" });

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
      notFound: isNotFound,
      upstreamStatus: null,
      upstreamContentType: null,
      fetchedAt: now,
      expiresAt,
    });

    logger.debug({ domain, isNotFound }, "favicon failure persisted");
  } catch (err) {
    logger.error({ err, domain }, "failed to persist favicon failure");
    // Don't throw - persistence failure shouldn't fail the workflow
  }
}
