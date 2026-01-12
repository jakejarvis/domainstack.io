import { getWorkflowMetadata } from "workflow";
import {
  fetchIconFromSources,
  type IconFetchResult,
} from "@/workflows/shared/fetch-icon";

export interface FaviconWorkflowInput {
  domain: string;
}

export interface FaviconWorkflowResult {
  success: boolean;
  data: { url: string | null };
}

const DEFAULT_SIZE = 32;

/**
 * Durable favicon workflow with two main steps:
 * 1. Fetch from multiple sources with fallbacks
 * 2. Process, store, and persist (combined to avoid serializing large buffers)
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

  // Step 2b: Process, store, and persist in one step
  // (avoids serializing processed image between steps)
  const result = await processAndStore(
    domain,
    fetchResult.imageBase64,
    fetchResult.sourceName,
  );

  if (!result.success) {
    await persistFailure(domain, false);
    return {
      success: false,
      data: { url: null },
    };
  }

  return {
    success: true,
    data: { url: result.url },
  };
}

/**
 * Step: Process image, store to Vercel Blob, and persist to database.
 * Combined into one step to avoid serializing large image buffers between steps.
 */
async function processAndStore(
  domain: string,
  imageBase64: string,
  sourceName: string,
): Promise<{ success: true; url: string } | { success: false }> {
  "use step";

  const { convertBufferToImageCover } = await import("@/lib/image");
  const { storeImage } = await import("@/lib/storage");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertFavicon } = await import("@/lib/db/repos/favicons");
  const { ttlForFavicon } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "favicon-workflow" });

  try {
    // 1. Process image (handles ICO files with icojs fallback)
    const inputBuffer = Buffer.from(imageBase64, "base64");
    const processedBuffer = await convertBufferToImageCover(
      inputBuffer,
      DEFAULT_SIZE,
      DEFAULT_SIZE,
      null, // contentType - let sharp/icojs detect
    );

    if (!processedBuffer || processedBuffer.length === 0) {
      logger.warn(
        { domain, inputSize: inputBuffer.length },
        "image processing returned empty result",
      );
      return { success: false };
    }

    // 2. Store to Vercel Blob
    const { url, pathname } = await storeImage({
      kind: "favicon",
      domain,
      buffer: processedBuffer,
      width: DEFAULT_SIZE,
      height: DEFAULT_SIZE,
    });

    // 3. Persist to database
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

    logger.debug({ domain }, "favicon processed and stored");

    return { success: true, url };
  } catch (err) {
    const { workflowRunId } = getWorkflowMetadata();
    logger.error({ err, domain, workflowRunId }, "failed to process favicon");
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
    const { workflowRunId } = getWorkflowMetadata();
    logger.error(
      { err, domain, workflowRunId },
      "failed to persist favicon failure",
    );
    throw err; // Re-throw so workflow can retry
  }
}
