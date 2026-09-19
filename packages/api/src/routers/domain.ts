import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Section } from "@domainstack/constants";
import { fetchFavicon } from "@domainstack/core/services/favicon";
import { logLookupFailure } from "@domainstack/core/services/fetch-errors";
import { lookupSection } from "@domainstack/core/services/lookup";
import { createLogger } from "@domainstack/logger";
import { toRegistrableDomain } from "@domainstack/utils/domain";

import { withDomainAccessUpdate } from "../middleware";
import { publicProcedure } from "../procedures";
import { rateLimit, withTrpcRateLimitErrors } from "../rate-limit";
import { createTRPCRouter } from "../trpc";

const logger = createLogger({ source: "routers/domain" });

const DomainInputSchema = z.object({ domain: z.string().min(1) }).transform(({ domain }) => {
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: '"domain" must be a valid registrable domain (e.g., example.com)',
    });
  }
  return { domain: registrable };
});

/**
 * One procedure per report section: normalize the domain, record the access,
 * then let `lookupSection` decide between cache and a metered fresh fetch.
 */
function lookupProcedure<S extends Section>(section: S) {
  return publicProcedure
    .input(DomainInputSchema)
    .use(withDomainAccessUpdate)
    .query(({ ctx, input }) =>
      withTrpcRateLimitErrors(() =>
        lookupSection(section, input.domain, { identifier: ctx.session?.user?.id ?? ctx.ip }),
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
   * Fetches from multiple sources (Google, DuckDuckGo, direct).
   * Fresh cache hits skip rate limiting so archived lists over the cap still load icons.
   */
  getFavicon: publicProcedure.input(DomainInputSchema).query(async ({ ctx, input, path }) => {
    const { getFavicon: getCachedFavicon } = await import("@domainstack/db/queries/favicons");

    // Check cache first — cached reads must not consume the rate-limit budget
    const cached = await getCachedFavicon(input.domain);
    if (cached.data && !cached.stale) {
      return { success: true, cached: true, data: cached.data };
    }

    await rateLimit({ ctx, path, config: { requests: 100, window: "1 m" } });

    // Fetch fresh data
    try {
      const result = await fetchFavicon(input.domain);
      return { success: true, cached: false, data: result.data };
    } catch (err) {
      logLookupFailure(logger, { domain: input.domain, err }, "favicon", "debug");
      return {
        success: false,
        cached: false,
        data: null,
        error: "fetch_failed",
      };
    }
  }),
});
