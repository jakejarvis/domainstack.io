/**
 * Favicon service - fetches and persists favicons.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * Uses multiple fallback sources (Google, DuckDuckGo, direct).
 */

import { ensureDomainRecord } from "@domainstack/db/queries/domains";
import { upsertFavicon } from "@domainstack/db/queries/favicons";
import { optimizeImage, storeImage } from "@domainstack/image";
import {
  isExpectedDnsError,
  safeFetch,
  SafeFetchError,
  type SafeFetchErrorCode,
} from "@domainstack/safe-fetch";
import type { FaviconResponse } from "@domainstack/types";

import { ttlForFavicon } from "../ttl";

// ============================================================================
// Types
// ============================================================================

export type FaviconResult = { success: true; data: FaviconResponse };

interface IconFetchSuccess {
  success: true;
  imageBase64: string;
  contentType: string | null;
  status: number;
  sourceName: string;
}

interface IconFetchFailure {
  success: false;
  allNotFound: boolean;
}

type IconFetchResult = IconFetchSuccess | IconFetchFailure;

interface IconSource {
  url: string;
  name: string;
  headers?: Record<string, string>;
  allowHttp?: boolean;
}

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
 * @throws Error on transient failures - TanStack Query retries these
 */
export async function fetchFavicon(domain: string): Promise<FaviconResult> {
  // Step 1: Fetch from sources
  const fetchResult = await fetchIconFromSources(domain);

  if (!fetchResult.success) {
    // If at least one source failed with a transient error (not 404/400),
    // throw so TanStack Query can retry instead of caching failure
    if (!fetchResult.allNotFound) {
      throw new Error(`Favicon fetch failed for ${domain} (transient)`);
    }

    // Persist "no favicon found" as a cached state (all sources returned 404)
    await persistFailure(domain, true);

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

  let allNotFound = true;

  for (const source of sources) {
    try {
      const headers = {
        Accept: "image/avif,image/webp,image/png,image/*;q=0.9,*/*;q=0.8",
        ...source.headers,
      };

      const asset = await safeFetch({
        url: source.url,
        userAgent: process.env.EXTERNAL_USER_AGENT,
        headers,
        maxBytes: MAX_BYTES,
        timeoutMs: TIMEOUT_MS,
        maxRedirects: 2,
        allowHttp: source.allowHttp ?? false,
      });

      if (!asset.ok) {
        const isDefinitiveNotFoundStatus = asset.status === 404 || asset.status === 400;
        if (!isDefinitiveNotFoundStatus) {
          allNotFound = false;
        }
        continue;
      }

      allNotFound = false;

      return {
        success: true,
        imageBase64: asset.buffer.toString("base64"),
        contentType: asset.contentType ?? null,
        status: asset.status,
        sourceName: source.name,
      };
    } catch (err) {
      if (!isDefinitiveNotFoundError(err)) {
        allNotFound = false;
      }
    }
  }

  return { success: false, allNotFound };
}

const DEFINITIVE_CODES = new Set<SafeFetchErrorCode>([
  "host_blocked",
  "host_not_allowed",
  "private_ip",
  "protocol_not_allowed",
  "invalid_url",
]);

function isDefinitiveNotFoundError(err: unknown): boolean {
  if (!(err instanceof SafeFetchError)) return false;

  // safe-fetch also raises dns_error for lookup timeouts, which are transient.
  if (err.code === "dns_error") return isExpectedDnsError(err);

  return DEFINITIVE_CODES.has(err.code);
}

// ============================================================================
// Internal: Process and Store
// ============================================================================

async function processAndStore(domain: string, icon: IconFetchSuccess): Promise<{ url: string }> {
  // 1. Process image
  const inputBuffer = Buffer.from(icon.imageBase64, "base64");
  const optimized = await optimizeImage(inputBuffer, {
    width: DEFAULT_SIZE,
    height: DEFAULT_SIZE,
  });

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

async function persistFailure(domain: string, isNotFound: boolean): Promise<void> {
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
}
