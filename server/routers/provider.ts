import { start } from "workflow/api";
import z from "zod";
import { getProviderById } from "@/lib/db/repos/providers";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import { providerLogoWorkflow } from "@/workflows/provider-logo";

export const providerRouter = createTRPCRouter({
  getProviderIcon: publicProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const provider = await getProviderById(input.providerId);
      if (!provider?.domain) {
        // Return null instead of throwing to avoid logging errors for missing icons
        return { url: null };
      }

      const run = await start(providerLogoWorkflow, [
        { providerId: input.providerId, providerDomain: provider.domain },
      ]);
      const result = await run.returnValue;

      return { url: result.url };
    }),
});
