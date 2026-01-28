import { start } from "workflow/api";
import z from "zod";
import { providerLogosRepo, providersRepo } from "@/lib/db/repos";
import { withSwrCache } from "@/lib/workflow/swr";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const providerRouter = createTRPCRouter({
  /**
   * Get a provider's logo/icon using a durable workflow.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getProviderIcon: publicProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const provider = await providersRepo.getProviderById(input.providerId);
      const providerDomain = provider?.domain;
      if (!providerDomain) {
        // Return null instead of throwing to avoid logging errors for missing icons
        return { success: false, cached: false, stale: false, data: null };
      }

      const { providerLogoWorkflow } = await import(
        "@/workflows/provider-logo"
      );

      return withSwrCache({
        workflowName: "provider-logo",
        domain: input.providerId, // Use providerId as the cache key
        getCached: () => providerLogosRepo.getProviderLogo(input.providerId),
        startWorkflow: () =>
          start(providerLogoWorkflow, [
            { providerId: input.providerId, providerDomain },
          ]),
      });
    }),
});
