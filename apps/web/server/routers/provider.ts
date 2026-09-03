import { z } from "zod";

import { createTRPCRouter, rateLimit, publicProcedure } from "@/trpc/init";
import { getProviderById, getProviderLogo } from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";
import { fetchProviderLogo } from "@domainstack/server";

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
        logger.error({ providerId: input.providerId, err }, "provider logo fetch failed");
        return {
          success: false,
          cached: false,
          data: null,
          error: "fetch_failed",
        };
      }
    }),
});
