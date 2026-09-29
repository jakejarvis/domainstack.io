/**
 * Provider logo service - fetches and persists provider logos.
 *
 * Similar to favicon service but with logo.dev support for higher quality logos.
 */

import { upsertProviderLogo } from "@domainstack/db/queries/provider-logos";
import { storeImage } from "@domainstack/image";
import type { ProviderLogoResponse } from "@domainstack/types";

import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import { fetchFirstIcon, type IconFetchResult, type IconSource } from "../lib/icon-sources";
import { ttlForProviderIcon } from "../lib/ttl";

// ============================================================================
// Types
// ============================================================================

export type ProviderLogoResult = { success: true; data: ProviderLogoResponse };

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SIZE = 64;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB for provider logos
const TIMEOUT_MS = 2000;

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Fetch and persist logo for a provider.
 *
 * @param providerId - The provider's UUID
 * @param providerDomain - The provider's domain for fetching the logo
 * @returns Provider logo result with URL or null
 *
 * @throws Error on transient failures - the lookup reports these as `fetch_failed`
 */
export async function fetchProviderLogo(
  providerId: string,
  providerDomain: string,
): Promise<ProviderLogoResult> {
  // Step 1: Fetch from sources
  const fetchResult = await fetchIconFromSources(providerDomain);

  if (!fetchResult.success) {
    // If at least one source failed with a transient error (not 404/400),
    // throw so the failure is reported instead of cached
    if (!fetchResult.allNotFound) {
      throw new RemoteDataUnavailableError(`Provider logo unavailable for ${providerDomain}`);
    }

    // Persist "no logo found" as a cached state (all sources returned 404)
    await persistFailure(providerId);

    // "No logo" is a valid cached result, not a failure
    return {
      success: true,
      data: { url: null },
    };
  }

  // Step 2: Process, store, and persist
  const result = await processAndStore(
    providerId,
    providerDomain,
    fetchResult.optimized,
    fetchResult.sourceName,
  );

  return {
    success: true,
    data: { url: result.url },
  };
}

// ============================================================================
// Internal: Fetch Icon From Sources
// ============================================================================

async function fetchIconFromSources(domain: string): Promise<IconFetchResult> {
  const sources: IconSource[] = [];

  // Primary: Logo.dev API (if API key is configured)
  const logoDevKey = process.env.LOGO_DEV_PUBLISHABLE_KEY;
  if (logoDevKey) {
    sources.push({
      url: `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(logoDevKey)}&size=${DEFAULT_SIZE}&format=png&fallback=404`,
      name: "logo_dev",
      headers: {
        Referer: process.env.NEXT_PUBLIC_BASE_URL ?? "",
      },
    });
  }

  // Fallback to standard favicon sources
  sources.push(
    {
      url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${DEFAULT_SIZE}`,
      name: "google",
    },
    {
      url: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
      name: "duckduckgo",
    },
    {
      url: `https://${domain}/favicon.ico`,
      name: "direct_https",
    },
    {
      url: `http://${domain}/favicon.ico`,
      name: "direct_http",
      allowHttp: true,
    },
  );

  return fetchFirstIcon(sources, {
    size: DEFAULT_SIZE,
    maxBytes: MAX_BYTES,
    timeoutMs: TIMEOUT_MS,
  });
}

// ============================================================================
// Internal: Process and Store
// ============================================================================

async function processAndStore(
  providerId: string,
  providerDomain: string,
  optimized: Buffer,
  sourceName: string,
): Promise<{ url: string }> {
  // 1. Check the decoded image
  if (optimized.length === 0) {
    throw new Error(`Image processing returned empty result for provider ${providerId}`);
  }

  // 2. Store to blob storage
  const { url, pathname } = await storeImage({
    kind: "provider-logo",
    domain: providerDomain,
    buffer: optimized,
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

  return { url };
}

// ============================================================================
// Internal: Persist Failure
// ============================================================================

async function persistFailure(providerId: string): Promise<void> {
  const now = new Date();
  const expiresAt = ttlForProviderIcon(now);

  await upsertProviderLogo({
    providerId,
    url: null,
    pathname: null,
    size: DEFAULT_SIZE,
    source: null,
    notFound: true,
    fetchedAt: now,
    expiresAt,
  });
}
