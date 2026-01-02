import { cache } from "react";
import { ensureDomainRecord } from "@/lib/db/repos/domains";
import { getFaviconByDomain, upsertFavicon } from "@/lib/db/repos/favicons";
import {
  getProviderLogoByProviderId,
  upsertProviderLogo,
} from "@/lib/db/repos/provider-logos";
import { processIcon } from "@/lib/icons/pipeline";
import { buildIconSources } from "@/lib/icons/sources";
import type { BlobUrlResponse } from "@/lib/schemas";
import { ttlForFavicon, ttlForProviderIcon } from "@/lib/ttl";

const DEFAULT_SIZE = 32;
const DEFAULT_PROVIDER_ICON_SIZE = 64;

/**
 * Get or create a favicon for a domain.
 * Uses React's cache() for request-scoped deduplication.
 */
export const getFavicon = cache(async function getFavicon(
  domain: string,
): Promise<BlobUrlResponse> {
  return processIcon({
    identifier: domain,
    blobKind: "favicon",
    blobDomain: domain,
    sources: buildIconSources(domain, { size: DEFAULT_SIZE }),
    getCachedRecord: async () => {
      const record = await getFaviconByDomain(domain);
      return record ? { url: record.url, notFound: record.notFound } : null;
    },
    persistRecord: async (data) => {
      const domainRecord = await ensureDomainRecord(domain);
      await upsertFavicon({
        domainId: domainRecord.id,
        ...data,
      });
    },
    ttlFn: ttlForFavicon,
    size: DEFAULT_SIZE,
  });
});

/**
 * Get or create a provider icon by provider ID.
 * Uses React's cache() for request-scoped deduplication.
 */
export const getProviderIcon = cache(async function getProviderIcon(
  providerId: string,
  providerDomain: string,
): Promise<BlobUrlResponse> {
  return processIcon({
    identifier: providerId,
    blobKind: "provider-logo",
    blobDomain: providerDomain,
    sources: buildIconSources(providerDomain, {
      size: DEFAULT_PROVIDER_ICON_SIZE,
      useLogoDev: true,
    }),
    getCachedRecord: async () => {
      const record = await getProviderLogoByProviderId(providerId);
      return record ? { url: record.url, notFound: record.notFound } : null;
    },
    persistRecord: async (data) => {
      // Wrapper for existing provider logo table (preserving DB structure)
      await upsertProviderLogo({
        providerId,
        ...data,
      });
    },
    ttlFn: ttlForProviderIcon,
    size: DEFAULT_PROVIDER_ICON_SIZE,
    timeoutMs: 2000,
    maxBytes: 2 * 1024 * 1024, // 2MB
  });
});
