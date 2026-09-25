import type { Section } from "@domainstack/constants";
import { lookupFavicon, lookupSection } from "@domainstack/core/lookup";

import { DomainInputSchema } from "../domain-input";
import { publicProcedure } from "../procedures";
import { rateLimitIdentifier, withTrpcRateLimitErrors } from "../rate-limit";
import { createTRPCRouter } from "../trpc";

/**
 * One procedure per report section: normalize the domain, then let
 * `lookupSection` decide between cache and a metered fresh fetch.
 */
function lookupProcedure<S extends Section>(section: S) {
  return publicProcedure
    .input(DomainInputSchema)
    .query(({ ctx, input }) =>
      withTrpcRateLimitErrors(() =>
        lookupSection(section, input.domain, { identifier: rateLimitIdentifier(ctx) }),
      ),
    );
}

export const domainRouter = createTRPCRouter({
  getRegistration: lookupProcedure("registration"),
  getDnsRecords: lookupProcedure("dns"),
  getHosting: lookupProcedure("hosting"),
  getCertificates: lookupProcedure("certificates"),
  getHeaders: lookupProcedure("headers"),
  getSeo: lookupProcedure("seo"),

  /**
   * Get a favicon for a domain.
   * Fresh cache hits skip rate limiting so archived lists over the cap still load icons.
   */
  getFavicon: publicProcedure
    .input(DomainInputSchema)
    .query(({ ctx, input }) =>
      withTrpcRateLimitErrors(() =>
        lookupFavicon(input.domain, { identifier: rateLimitIdentifier(ctx) }),
      ),
    ),
});
