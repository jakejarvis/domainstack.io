import {
  fetchIconFromSources,
  type IconFetchResult,
} from "@/workflows/shared/fetch-icon";
import { processIcon } from "@/workflows/shared/process-icon";

export interface FaviconWorkflowInput {
  domain: string;
}

export interface FaviconWorkflowResult {
  success: boolean;
  data: { url: string | null };
}

const DEFAULT_SIZE = 32;

/**
 * Durable favicon workflow that breaks down icon fetching into
 * independently retryable steps:
 * 1. Fetch from multiple sources with fallbacks
 * 2. Process image (convert to WebP)
 * 3. Store to Vercel Blob and persist to database
 */
export async function faviconWorkflow(
  input: FaviconWorkflowInput,
): Promise<FaviconWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch from sources (shared step)
  const fetchResult: IconFetchResult = await fetchIconFromSources(domain, {
    size: DEFAULT_SIZE,
    maxBytes: 1 * 1024 * 1024, // 1MB
    timeoutMs: 1500,
    useLogoDev: false,
    loggerSource: "favicon-workflow",
    errorPrefix: "Favicon",
  });

  if (!fetchResult.success) {
    // Step 2a: Persist failure
    await persistFailure(domain, fetchResult.allNotFound);

    return {
      success: true,
      data: { url: null },
    };
  }

  // Step 2b: Process image (shared step)
  const processedResult = await processIcon(
    fetchResult.imageBase64,
    DEFAULT_SIZE,
  );

  if (!processedResult.success) {
    // Image processing failed
    await persistFailure(domain, false);
    return {
      success: false,
      data: { url: null },
    };
  }

  // Step 3: Store and persist
  const storeResult = await storeAndPersist(
    domain,
    processedResult.imageBase64,
    fetchResult.sourceName,
  );

  return {
    success: true,
    data: { url: storeResult.url },
  };
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
