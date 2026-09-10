import { z } from "zod";

import { createTRPCRouter, rateLimit, publicProcedure } from "@/trpc/init";
import { getProviderLogo } from "@domainstack/db/queries/provider-logos";
import { getProviderById } from "@domainstack/db/queries/providers";
import { createLogger } from "@domainstack/logger";
import { RemoteDataUnavailableError } from "@domainstack/server/services/fetch-errors";
import { fetchProviderLogo } from "@domainstack/server/services/provider-logo";

const logger = createLogger({ source: "routers/provider" });

export const providerRouter = createTRPCRouter({
  /**
   * Get a provider's logo/icon.
   * Returns cached data if fresh, otherwise fetches fresh data.
   */
  getProviderIcon: publicProcedure
    .input(z.object({ providerId: z.uuid() }))
    .query(async ({ ctx, input, path }) => {
      const [provider, cached] = await Promise.all([
        getProviderById(input.providerId),
        getProviderLogo(input.providerId),
      ]);
      const providerDomain = provider?.domain;
      if (!providerDomain) {
        // Return null instead of throwing to avoid logging errors for missing icons
        return { success: false, cached: false, data: null };
      }
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

      await rateLimit({ ctx, path, config: { requests: 60, window: "1 m" } });

      // Fetch fresh data
      try {
        const result = await fetchProviderLogo(input.providerId, providerDomain);
        return { success: true, cached: false, data: result.data };
      } catch (err) {
        if (err instanceof RemoteDataUnavailableError) {
          logger.debug({ providerId: input.providerId, err }, "provider logo unavailable");
        } else {
          logger.error({ providerId: input.providerId, err }, "provider logo failed unexpectedly");
        }
        return {
          success: false,
          cached: false,
          data: null,
          error: "fetch_failed",
        };
      }
    }),
});
