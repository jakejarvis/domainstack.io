import { getProviderById, getProviderLogo } from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";
import { fetchProviderLogo } from "@domainstack/server";
import z from "zod";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

const logger = createLogger({ source: "provider-router" });

export const providerRouter = createTRPCRouter({
  /**
   * Get a provider's logo/icon.
   * Returns cached data if fresh, otherwise fetches fresh data.
   */
  getProviderIcon: publicProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const provider = await getProviderById(input.providerId);
      const providerDomain = provider?.domain;
      if (!providerDomain) {
        // Return null instead of throwing to avoid logging errors for missing icons
        return { success: false, cached: false, data: null };
      }

      // Check cache first
      const cached = await getProviderLogo(input.providerId);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

      // Fetch fresh data
      try {
        const result = await fetchProviderLogo(
          input.providerId,
          providerDomain,
        );
        return { success: true, cached: false, data: result.data };
      } catch (err) {
        logger.error(
          { providerId: input.providerId, err },
          "provider logo fetch failed",
        );
        return {
          success: false,
          cached: false,
          data: null,
          error: "fetch_failed",
        };
      }
    }),
});
