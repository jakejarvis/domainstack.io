import type { FaviconResponse } from "@domainstack/types";
import { FatalError } from "workflow";
import type { WorkflowResult } from "@/lib/workflow/types";
import {
  fetchIconFromSources,
  type IconFetchResult,
} from "@/workflows/shared/fetch-icon";

export interface FaviconWorkflowInput {
  domain: string;
}

export type FaviconWorkflowResult = WorkflowResult<FaviconResponse>;

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
  });

  if (!fetchResult.success) {
    // Step 2a: Persist "no favicon found" as a cached state
    await persistFailure(domain, fetchResult.allNotFound);

    // "No favicon" is a valid cached result, not a failure
    return {
      success: true,
      data: { url: null },
    };
  }

  // Step 2b: Process, store, and persist in one step
  // (avoids serializing processed image between steps)
  // Note: processAndStore throws FatalError on failure
  const result = await processAndStore(
    domain,
    fetchResult.imageBase64,
    fetchResult.sourceName,
  );

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
): Promise<{ success: true; url: string }> {
  "use step";

  const { optimizeImage } = await import("@/lib/image");
  const { storeImage } = await import("@/lib/storage");
  const { ensureDomainRecord, upsertFavicon } = await import(
    "@domainstack/db/queries"
  );
  const { ttlForFavicon } = await import("@domainstack/server/ttl");

  try {
    // 1. Process image (handles ICO/SVG files with appropriate fallbacks)
    const inputBuffer = Buffer.from(imageBase64, "base64");
    const optimized = await optimizeImage(inputBuffer, {
      width: DEFAULT_SIZE,
      height: DEFAULT_SIZE,
    });

    if (optimized.length === 0) {
      throw new FatalError(`Image processing returned empty result: ${domain}`);
    }

    // 2. Store to Vercel Blob
    const { url, pathname } = await storeImage({
      kind: "favicon",
      domain,
      buffer: optimized,
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

    return { success: true, url };
  } catch (err) {
    throw new FatalError(
      `Failed to process favicon for domain ${domain}: ${err instanceof Error ? err.message : String(err)}`,
    );
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

  const { ensureDomainRecord, upsertFavicon } = await import(
    "@domainstack/db/queries"
  );
  const { ttlForFavicon } = await import("@domainstack/server/ttl");

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
  } catch (err) {
    throw new FatalError(
      `Failed to persist favicon for domain ${domain}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
