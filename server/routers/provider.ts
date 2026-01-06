import z from "zod";
import { getProviderById } from "@/lib/db/repos/providers";
import { getProviderIcon } from "@/lib/icons/provider";
import { BlobUrlResponseSchema } from "@/lib/schemas";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const providerRouter = createTRPCRouter({
  getProviderIcon: publicProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .output(BlobUrlResponseSchema)
    .query(async ({ input }) => {
      const provider = await getProviderById(input.providerId);
      if (!provider?.domain) {
        // Return null instead of throwing to avoid logging errors for missing icons
        return { url: null };
      }
      return getProviderIcon(input.providerId, provider.domain);
    }),
});
