import { start } from "workflow/api";
import z from "zod";
import { getProviderById } from "@/lib/db/repos/providers";
import {
  getDeduplicationKey,
  startWithDeduplication,
} from "@/lib/workflow/deduplication";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const providerRouter = createTRPCRouter({
  getProviderIcon: publicProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const provider = await getProviderById(input.providerId);
      const providerDomain = provider?.domain;
      if (!providerDomain) {
        // Return null instead of throwing to avoid logging errors for missing icons
        return { success: false, url: null };
      }

      const { getProviderLogoByProviderId } = await import(
        "@/lib/db/repos/provider-logos"
      );

      // Check cache first
      const cachedRecord = await getProviderLogoByProviderId(input.providerId);

      if (cachedRecord) {
        // Only treat as cache hit if we have a definitive result:
        // - url is present (string), OR
        // - url is null but marked as permanently not found
        const isDefinitiveResult =
          cachedRecord.url !== null || cachedRecord.notFound === true;

        if (isDefinitiveResult) {
          return {
            success: true,
            cached: true,
            data: {
              url: cachedRecord.url,
            },
          };
        }
      }

      // Cache miss - run workflow with deduplication
      const { providerLogoWorkflow } = await import(
        "@/workflows/provider-logo"
      );
      const key = getDeduplicationKey("provider-logo", input.providerId);
      const result = await startWithDeduplication(key, async () => {
        const run = await start(providerLogoWorkflow, [
          { providerId: input.providerId, providerDomain },
        ]);
        return run.returnValue;
      });

      return {
        ...result,
        cached: false,
      };
    }),
});
