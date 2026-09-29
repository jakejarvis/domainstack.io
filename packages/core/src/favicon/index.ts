/**
 * Favicon service - fetches and persists favicons.
 *
 * Uses multiple fallback sources (Google, DuckDuckGo, direct).
 */

import { ensureDomainRecord } from "@domainstack/db/queries/domains";
import { upsertFavicon } from "@domainstack/db/queries/favicons";
import { storeImage } from "@domainstack/image";
import type { FaviconResponse } from "@domainstack/types";

import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import { fetchFirstIcon, type IconFetchResult, type IconSource } from "../lib/icon-sources";
import { ttlForFavicon } from "../lib/ttl";

// ============================================================================
// Types
// ============================================================================

export type FaviconResult = { success: true; data: FaviconResponse };

type IconFetchSuccess = Extract<IconFetchResult, { success: true }>;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SIZE = 32;
const MAX_BYTES = 1 * 1024 * 1024; // 1MB
const TIMEOUT_MS = 1500;

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Fetch and persist favicon for a domain.
 *
 * @param domain - The domain to fetch favicon for
 * @returns Favicon result with URL or null
 *
 * @throws Error on transient failures - the lookup reports these as `fetch_failed`
 */
export async function fetchFavicon(domain: string): Promise<FaviconResult> {
  // Step 1: Fetch from sources
  const fetchResult = await fetchIconFromSources(domain);

  if (!fetchResult.success) {
    // If at least one source failed with a transient error (not 404/400),
    // throw so the failure is reported instead of cached
    if (!fetchResult.allNotFound) {
      throw new RemoteDataUnavailableError(`Favicon unavailable for ${domain}`);
    }

    // Persist "no favicon found" as a cached state (all sources returned 404)
    await persistFailure(domain);

    // "No favicon" is a valid cached result, not a failure
    return {
      success: true,
      data: { url: null },
    };
  }

  // Step 2: Process, store, and persist
  const result = await processAndStore(domain, fetchResult);

  return {
    success: true,
    data: { url: result.url },
  };
}

// ============================================================================
// Internal: Fetch Icon From Sources
// ============================================================================

async function fetchIconFromSources(domain: string): Promise<IconFetchResult> {
  const sources: IconSource[] = [
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
  ];

  return fetchFirstIcon(sources, {
    size: DEFAULT_SIZE,
    maxBytes: MAX_BYTES,
    timeoutMs: TIMEOUT_MS,
  });
}

// ============================================================================
// Internal: Process and Store
// ============================================================================

async function processAndStore(domain: string, icon: IconFetchSuccess): Promise<{ url: string }> {
  // 1. Check the decoded image
  const { optimized } = icon;

  if (optimized.length === 0) {
    throw new Error(`Image processing returned empty result: ${domain}`);
  }

  // 2. Store to blob storage
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
    source: icon.sourceName,
    notFound: false,
    upstreamStatus: icon.status,
    upstreamContentType: icon.contentType,
    fetchedAt: now,
    expiresAt,
  });

  return { url };
}

// ============================================================================
// Internal: Persist Failure
// ============================================================================

async function persistFailure(domain: string): Promise<void> {
  const domainRecord = await ensureDomainRecord(domain);
  const now = new Date();
  const expiresAt = ttlForFavicon(now);

  await upsertFavicon({
    domainId: domainRecord.id,
    url: null,
    pathname: null,
    size: DEFAULT_SIZE,
    source: null,
    notFound: true,
    upstreamStatus: null,
    upstreamContentType: null,
    fetchedAt: now,
    expiresAt,
  });
}
