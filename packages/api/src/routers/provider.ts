import { z } from "zod";

import { lookupProviderLogo } from "@domainstack/core/services/lookup";

import { publicProcedure } from "../procedures";
import { rateLimitIdentifier, withTrpcRateLimitErrors } from "../rate-limit";
import { createTRPCRouter } from "../trpc";

export const providerRouter = createTRPCRouter({
  /**
   * Get a provider's logo/icon.
   * Returns cached data if fresh, otherwise fetches fresh data.
   */
  getProviderIcon: publicProcedure
    .input(z.object({ providerId: z.uuid() }))
    .query(({ ctx, input }) =>
      withTrpcRateLimitErrors(() =>
        lookupProviderLogo(input.providerId, { identifier: rateLimitIdentifier(ctx) }),
      ),
    ),
});
