/**
 * Provider logo service - fetches and persists provider logos.
 *
 * Similar to favicon service but with logo.dev support for higher quality logos.
 */

import { upsertProviderLogo } from "@domainstack/db/queries";
import { optimizeImage, storeImage } from "@domainstack/image";
import { safeFetch } from "@domainstack/safe-fetch";
import type { ProviderLogoResponse } from "@domainstack/types";
import { ttlForProviderIcon } from "../ttl";

// ============================================================================
// Types
// ============================================================================

export type ProviderLogoResult = { success: true; data: ProviderLogoResponse };

interface IconFetchSuccess {
  success: true;
  imageBase64: string;
  contentType: string | null;
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
 * @throws Error on transient failures - TanStack Query retries these
 */
export async function fetchProviderLogo(
  providerId: string,
  providerDomain: string,
): Promise<ProviderLogoResult> {
  // Step 1: Fetch from sources
  const fetchResult = await fetchIconFromSources(providerDomain);

  if (!fetchResult.success) {
    // If at least one source failed with a transient error (not 404/400),
    // throw so TanStack Query can retry instead of caching failure
    if (!fetchResult.allNotFound) {
      throw new Error(
        `Provider logo fetch failed for ${providerDomain} (transient)`,
      );
    }

    // Persist "no logo found" as a cached state (all sources returned 404)
    await persistFailure(providerId, true);

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
    fetchResult.imageBase64,
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
      url: `https://img.logo.dev/${domain}?token=${logoDevKey}&size=${DEFAULT_SIZE}&format=png&fallback=404`,
      name: "logo_dev",
      headers: {
        Referer: process.env.NEXT_PUBLIC_BASE_URL ?? "",
      },
    });
  }

  // Fallback to standard favicon sources
  sources.push(
    {
      url: `https://www.google.com/s2/favicons?domain=${domain}&sz=${DEFAULT_SIZE}`,
      name: "google",
    },
    {
      url: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
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
        const isDefinitiveNotFoundStatus =
          asset.status === 404 || asset.status === 400;
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

function isDefinitiveNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { name?: unknown; code?: unknown };
  if (maybe.name !== "SafeFetchError") return false;

  const definitiveCodes = new Set([
    "dns_error",
    "host_blocked",
    "host_not_allowed",
    "private_ip",
    "protocol_not_allowed",
    "invalid_url",
  ]);

  return typeof maybe.code === "string" && definitiveCodes.has(maybe.code);
}

// ============================================================================
// Internal: Process and Store
// ============================================================================

async function processAndStore(
  providerId: string,
  providerDomain: string,
  imageBase64: string,
  sourceName: string,
): Promise<{ url: string }> {
  // 1. Process image
  const inputBuffer = Buffer.from(imageBase64, "base64");
  const optimized = await optimizeImage(inputBuffer, {
    width: DEFAULT_SIZE,
    height: DEFAULT_SIZE,
  });

  if (optimized.length === 0) {
    throw new Error(
      `Image processing returned empty result for provider ${providerId}`,
    );
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

async function persistFailure(
  providerId: string,
  isNotFound: boolean,
): Promise<void> {
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
}
