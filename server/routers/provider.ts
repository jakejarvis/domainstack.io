import { TRPCError } from "@trpc/server";
import z from "zod";
import { getProviderById } from "@/lib/db/repos/providers";
import { BlobUrlResponseSchema } from "@/lib/schemas";
import { getProviderIcon } from "@/server/services/icons";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

export const providerRouter = createTRPCRouter({
  getProviderIcon: publicProcedure
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
      return getProviderIcon(input.providerId, provider.domain);
    }),
});
