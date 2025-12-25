import { cache } from "react";
import { buildFaviconSources } from "@/lib/build-favicon-sources";
import { BASE_URL } from "@/lib/constants/app";
import {
  getProviderLogoByProviderId,
  upsertProviderLogo,
} from "@/lib/db/repos/provider-logos";
import type { IconSource } from "@/lib/fetch-remote-icon";
import { fetchRemoteIcon } from "@/lib/fetch-remote-icon";
import type { BlobUrlResponse } from "@/lib/schemas";
import { ttlForProviderLogo } from "@/lib/ttl";

const DEFAULT_SIZE = 64;

/**
 * Build logo sources with Logo.dev as primary and favicon fallbacks
 */
function buildLogoSources(domain: string): IconSource[] {
  const sources: IconSource[] = [];

  // Primary: Logo.dev API (only if API key is configured)
  const logoDevKey = process.env.LOGO_DEV_PUBLISHABLE_KEY;
  if (logoDevKey) {
    const enc = encodeURIComponent(domain);
    sources.push({
      url: `https://img.logo.dev/${enc}?token=${logoDevKey}&size=${DEFAULT_SIZE}&format=png&fallback=404`,
      name: "logo_dev",
      headers: {
        Referer: BASE_URL,
      },
    });
  }

  // Fallback to standard favicon sources (DuckDuckGo, Google, direct attempts)
  sources.push(...buildFaviconSources(domain, DEFAULT_SIZE));

  return sources;
}

/**
 * Get or create a provider logo by provider ID.
 * Uses React's cache() for request-scoped deduplication.
 */
export const getProviderLogo = cache(async function getProviderLogo(
  providerId: string,
  providerDomain: string,
): Promise<BlobUrlResponse> {
  return fetchRemoteIcon({
    identifier: providerId,
    blobKind: "provider-logo",
    blobDomain: providerDomain,
    sources: buildLogoSources(providerDomain),
    getCachedRecord: async () => {
      const record = await getProviderLogoByProviderId(providerId);
      return record ? { url: record.url, notFound: record.notFound } : null;
    },
    persistRecord: async (data) => {
      await upsertProviderLogo({
        providerId,
        ...data,
      });
    },
    ttlFn: ttlForProviderLogo,
    logContext: { providerId, providerDomain },
    size: DEFAULT_SIZE,
    timeoutMs: 2000,
    maxBytes: 2 * 1024 * 1024, // 2MB
  });
});
