import { cache } from "react";
import {
  getProviderLogoByProviderId,
  upsertProviderLogo,
} from "@/lib/db/repos/provider-logos";
import { processIcon } from "@/lib/icons/pipeline";
import { buildIconSources } from "@/lib/icons/sources";
import type { BlobUrlResponse } from "@/lib/schemas";
import { ttlForProviderIcon } from "@/lib/ttl";

const DEFAULT_PROVIDER_ICON_SIZE = 64;

/**
 * Get or create a provider icon by provider ID.
 *
 * Uses the processIcon pipeline directly since provider
 * icons are typically smaller operations than domain favicons.
 *
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
