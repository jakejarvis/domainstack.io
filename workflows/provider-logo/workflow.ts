import { FatalError } from "workflow";
import {
  fetchIconFromSources,
  type IconFetchResult,
} from "@/workflows/shared/fetch-icon";

export interface ProviderLogoWorkflowInput {
  providerId: string;
  providerDomain: string;
}

export interface ProviderLogoWorkflowResult {
  success: boolean;
  data: {
    url: string | null;
  };
}

const DEFAULT_SIZE = 64;

/**
 * Durable provider logo workflow with two main steps:
 * 1. Fetch from multiple sources with fallbacks (including logo.dev)
 * 2. Process, store, and persist (combined to avoid serializing large buffers)
 */
export async function providerLogoWorkflow(
  input: ProviderLogoWorkflowInput,
): Promise<ProviderLogoWorkflowResult> {
  "use workflow";

  const { providerId, providerDomain } = input;

  // Step 1: Fetch from sources (shared step)
  const fetchResult: IconFetchResult = await fetchIconFromSources(
    providerDomain,
    {
      size: DEFAULT_SIZE,
      maxBytes: 2 * 1024 * 1024, // 2MB for provider logos
      timeoutMs: 2000,
      useLogoDev: true, // Enable logo.dev for provider logos
    },
  );

  if (!fetchResult.success) {
    // Step 2a: Persist failure
    await persistFailure(providerId, fetchResult.allNotFound);

    return {
      success: false,
      data: { url: null },
    };
  }

  // Step 2b: Process, store, and persist in one step
  // (avoids serializing processed image between steps)
  const result = await processAndStore(
    providerId,
    providerDomain,
    fetchResult.imageBase64,
    fetchResult.contentType,
    fetchResult.sourceName,
  );

  if (!result.success) {
    await persistFailure(providerId, false);
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
  providerId: string,
  providerDomain: string,
  imageBase64: string,
  contentType: string | null,
  sourceName: string,
): Promise<{ success: true; url: string } | { success: false }> {
  "use step";

  const { convertBufferToImageCover } = await import("@/lib/image");
  const { storeImage } = await import("@/lib/storage");
  const { upsertProviderLogo } = await import("@/lib/db/repos/provider-logos");
  const { ttlForProviderIcon } = await import("@/lib/ttl");

  try {
    // 1. Process image (handles ICO/SVG files with appropriate fallbacks)
    const inputBuffer = Buffer.from(imageBase64, "base64");
    const processedBuffer = await convertBufferToImageCover(
      inputBuffer,
      DEFAULT_SIZE,
      DEFAULT_SIZE,
      contentType,
    );

    if (!processedBuffer || processedBuffer.length === 0) {
      throw new FatalError(
        `Image processing returned empty result for provider ${providerId}`,
      );
    }

    // 2. Store to Vercel Blob
    const { url, pathname } = await storeImage({
      kind: "provider-logo",
      domain: providerDomain,
      buffer: processedBuffer,
      width: DEFAULT_SIZE,
      height: DEFAULT_SIZE,
    });

    // 3. Persist to database
    const now = new Date();
    const expiresAt = ttlForProviderIcon(now);

    await upsertProviderLogo({
      providerId,
      url,
      pathname: pathname ?? null,
      size: DEFAULT_SIZE,
      source: sourceName,
      notFound: false,
      fetchedAt: now,
      expiresAt,
    });

    return { success: true, url };
  } catch (err) {
    throw new FatalError(
      `Failed to process provider logo for provider ${providerId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Step: Persist failure to database cache
 */
async function persistFailure(
  providerId: string,
  isNotFound: boolean,
): Promise<void> {
  "use step";

  const { upsertProviderLogo } = await import("@/lib/db/repos/provider-logos");
  const { ttlForProviderIcon } = await import("@/lib/ttl");

  try {
    const now = new Date();
    const expiresAt = ttlForProviderIcon(now);

    await upsertProviderLogo({
      providerId,
      url: null,
      pathname: null,
      size: DEFAULT_SIZE,
      source: null,
      notFound: isNotFound,
      fetchedAt: now,
      expiresAt,
    });
  } catch (err) {
    throw new FatalError(
      `Failed to persist provider logo failure for provider ${providerId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
