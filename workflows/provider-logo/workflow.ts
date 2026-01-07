import {
  fetchIconFromSources,
  type IconFetchResult,
} from "@/workflows/shared/fetch-icon";
import { processIcon } from "@/workflows/shared/process-icon";

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
 * Durable provider logo workflow that breaks down icon fetching into
 * independently retryable steps:
 * 1. Fetch from multiple sources with fallbacks (including logo.dev)
 * 2. Process image (convert to WebP)
 * 3. Store to Vercel Blob and persist to database
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
      loggerSource: "provider-logo-workflow",
      errorPrefix: "Provider logo",
    },
  );

  if (!fetchResult.success) {
    // Step 2a: Persist failure
    await persistFailure(providerId, fetchResult.allNotFound);

    return {
      success: false,
      data: {
        url: null,
      },
    };
  }

  // Step 2b: Process image (shared step)
  const processedResult = await processIcon(
    fetchResult.imageBase64,
    DEFAULT_SIZE,
  );

  if (!processedResult.success) {
    // Image processing failed
    await persistFailure(providerId, false);
    return {
      success: false,
      data: {
        url: null,
      },
    };
  }

  // Step 3: Store and persist
  const storeResult = await storeAndPersist(
    providerId,
    providerDomain,
    processedResult.imageBase64,
    fetchResult.sourceName,
  );

  return {
    success: true,
    data: {
      url: storeResult.url,
    },
  };
}

/**
 * Step: Store to Vercel Blob and persist to database
 */
async function storeAndPersist(
  providerId: string,
  providerDomain: string,
  imageBase64: string,
  sourceName: string,
): Promise<{ url: string }> {
  "use step";

  const { storeImage } = await import("@/lib/storage");
  const { upsertProviderLogo } = await import("@/lib/db/repos/provider-logos");
  const { ttlForProviderIcon } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "provider-logo-workflow" });
  const buffer = Buffer.from(imageBase64, "base64");

  try {
    // Store to Vercel Blob
    const { url, pathname } = await storeImage({
      kind: "provider-logo",
      domain: providerDomain,
      buffer,
      width: DEFAULT_SIZE,
      height: DEFAULT_SIZE,
    });

    // Persist to database
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

    logger.debug({ providerId, providerDomain }, "provider logo stored");

    return { url };
  } catch (err) {
    logger.error({ err, providerId, providerDomain }, "failed to store logo");
    throw err; // Re-throw so workflow can retry
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
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "provider-logo-workflow" });

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

    logger.debug({ providerId, isNotFound }, "provider logo failure persisted");
  } catch (err) {
    logger.error({ err, providerId }, "failed to persist logo failure");
    // Don't throw - persistence failure shouldn't fail the workflow
  }
}
