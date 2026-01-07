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

  // Step 1: Fetch from sources
  const fetchResult = await fetchFromSources(providerDomain);

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

  // Step 2b: Process image
  const processedResult = await processImage(fetchResult.imageBase64);

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
 * Step: Fetch provider logo from multiple sources with fallbacks
 * This includes logo.dev for better quality provider logos.
 */
async function fetchFromSources(providerDomain: string): Promise<FetchResult> {
  "use step";

  const { buildIconSources } = await import("@/lib/icons/sources");
  const { fetchRemoteAsset, RemoteAssetError } = await import(
    "@/lib/fetch-remote-asset"
  );
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "provider-logo-workflow" });
  const sources = buildIconSources(providerDomain, {
    size: DEFAULT_SIZE,
    useLogoDev: true, // Enable logo.dev for provider logos
  });

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
        maxBytes: 2 * 1024 * 1024, // 2MB for provider logos
        timeoutMs: 2000,
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
        logger.warn(
          { err, domain: providerDomain, source: source.name },
          "fetch failed",
        );
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
