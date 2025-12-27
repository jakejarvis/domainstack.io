import { TRPCError } from "@trpc/server";
import z from "zod";
import { getProviderById } from "@/lib/db/repos/providers";
import { BlobUrlResponseSchema } from "@/lib/schemas";
import { getProviderLogo } from "@/server/services/provider-logo";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const providerRouter = createTRPCRouter({
  getProviderLogo: publicProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .output(BlobUrlResponseSchema)
    .query(async ({ input }) => {
      const provider = await getProviderById(input.providerId);
      if (!provider?.domain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Provider not found or has no domain",
        });
      }
      return getProviderLogo(input.providerId, provider.domain);
    }),
});
