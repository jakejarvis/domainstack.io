import { cache } from "react";
import { start } from "workflow/api";
import {
  getProviderLogoByProviderId,
  upsertProviderLogo,
} from "@/lib/db/repos/provider-logos";
import { processIcon } from "@/lib/icons/pipeline";
import { buildIconSources } from "@/lib/icons/sources";
import { createLogger } from "@/lib/logger/server";
import type { BlobUrlResponse } from "@/lib/schemas";
import { ttlForProviderIcon } from "@/lib/ttl";
import { faviconWorkflow } from "@/workflows/favicon/workflow";

const DEFAULT_PROVIDER_ICON_SIZE = 64;

const logger = createLogger({ source: "icons" });

/**
 * Get or create a favicon for a domain.
 *
 * This is a thin wrapper around the durable favicon workflow.
 * The workflow handles:
 * - Cache checking (Postgres)
 * - Multi-source fetching with fallbacks
 * - Image processing (WebP conversion)
 * - Storage (Vercel Blob) and database persistence
 *
 * Uses React's cache() for request-scoped deduplication.
 */
export const getFavicon = cache(async function getFavicon(
  domain: string,
): Promise<BlobUrlResponse> {
  try {
    // Start the durable workflow
    const run = await start(faviconWorkflow, [{ domain }]);

    logger.debug({ domain, runId: run.runId }, "favicon workflow started");

    // Wait for the workflow to complete and get the result
    const result = await run.returnValue;

    logger.debug(
      {
        domain,
        runId: run.runId,
        cached: result.cached,
        notFound: result.notFound,
      },
      "favicon workflow completed",
    );

    return { url: result.url };
  } catch (err) {
    logger.error({ err, domain }, "favicon workflow failed");

    // Return null URL on failure (maintains backward compatibility)
    return { url: null };
  }
});

/**
 * Get or create a provider icon by provider ID.
 *
 * Uses the processIcon pipeline directly (no workflow) since provider
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
