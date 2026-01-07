import { start } from "workflow/api";
import z from "zod";
import { getProviderById } from "@/lib/db/repos/providers";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const providerRouter = createTRPCRouter({
  getProviderIcon: publicProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const provider = await getProviderById(input.providerId);
      if (!provider?.domain) {
        // Return null instead of throwing to avoid logging errors for missing icons
        return { url: null };
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

      // Cache miss - run workflow
      const { providerLogoWorkflow } = await import(
        "@/workflows/provider-logo"
      );
      const run = await start(providerLogoWorkflow, [
        { providerId: input.providerId, providerDomain: provider.domain },
      ]);
      const result = await run.returnValue;

      return {
        ...result,
        cached: false,
      };
    }),
});
