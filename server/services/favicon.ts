import { cache } from "react";
import { buildFaviconSources } from "@/lib/build-favicon-sources";
import { ensureDomainRecord } from "@/lib/db/repos/domains";
import { getFaviconByDomain, upsertFavicon } from "@/lib/db/repos/favicons";
import { fetchRemoteIcon } from "@/lib/fetch-remote-icon";
import type { BlobUrlResponse } from "@/lib/schemas";
import { ttlForFavicon } from "@/lib/ttl";

const DEFAULT_SIZE = 32;

/**
 * Get or create a favicon for a domain.
 * Uses React's cache() for request-scoped deduplication - if multiple
 * components request the same favicon during SSR, only one fetch happens.
 */
export const getFavicon = cache(async function getFavicon(
  domain: string,
): Promise<BlobUrlResponse> {
  return fetchRemoteIcon({
    identifier: domain,
    blobKind: "favicon",
    blobDomain: domain,
    sources: buildFaviconSources(domain, DEFAULT_SIZE),
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
    logContext: { domain },
    size: DEFAULT_SIZE,
  });
});
