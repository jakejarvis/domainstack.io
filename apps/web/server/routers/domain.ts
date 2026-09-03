import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { toRegistrableDomain } from "@/lib/normalize-domain";
import { createTRPCRouter, rateLimit, publicProcedure, withDomainAccessUpdate } from "@/trpc/init";
import { createLogger } from "@domainstack/logger";
import type { RateLimitConfig } from "@domainstack/redis/ratelimit";
import {
  fetchCertificates,
  fetchDns,
  fetchFavicon,
  fetchHeaders,
  fetchHosting,
  fetchRegistration,
  fetchSeo,
  getHttpStatusMessage,
} from "@domainstack/server";

const logger = createLogger({ source: "routers/domain" });

const LOOKUP_RATE_LIMITS = {
  getRegistration: { requests: 30, window: "1 m" },
  getDnsRecords: { requests: 60, window: "1 m" },
  getHosting: { requests: 30, window: "1 m" },
  getCertificates: { requests: 30, window: "1 m" },
  getHeaders: { requests: 60, window: "1 m" },
  getSeo: { requests: 30, window: "1 m" },
  getFavicon: { requests: 100, window: "1 m" },
} as const satisfies Record<string, RateLimitConfig>;

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

export const domainRouter = createTRPCRouter({
  /**
   * Get registration data for a domain.
   * Performs WHOIS/RDAP lookup. Returns cached data if fresh, otherwise fetches.
   */
  getRegistration: publicProcedure
    .input(DomainInputSchema)
    .use(withDomainAccessUpdate)
    .query(async ({ ctx, input, path }) => {
      const { getCachedRegistration } = await import("@domainstack/db/queries");

      // Check cache first — cached reads must not consume the rate-limit budget
      const cached = await getCachedRegistration(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

      await rateLimit({ ctx, path, config: LOOKUP_RATE_LIMITS.getRegistration });

      // Fetch fresh data
      try {
        const result = await fetchRegistration(input.domain);
        if (result.success === false) {
          return {
            success: false,
            cached: false,
            data: null,
            error: result.error,
          };
        }
        return { success: true, cached: false, data: result.data };
      } catch (err) {
        logger.error({ domain: input.domain, err }, "registration fetch failed");
        return {
          success: false,
          cached: false,
          data: null,
          error: "lookup_failed",
        };
      }
    }),

  /**
   * Get DNS records for a domain.
   * Queries multiple DoH providers with automatic fallback.
   */
  getDnsRecords: publicProcedure
    .input(DomainInputSchema)
    .use(withDomainAccessUpdate)
    .query(async ({ ctx, input, path }) => {
      const { getCachedDns } = await import("@domainstack/db/queries");

      // Check cache first — cached reads must not consume the rate-limit budget
      const cached = await getCachedDns(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

      await rateLimit({ ctx, path, config: LOOKUP_RATE_LIMITS.getDnsRecords });

      // Fetch fresh data
      try {
        const result = await fetchDns(input.domain);
        return { success: true, cached: false, data: result.data };
      } catch (err) {
        logger.error({ domain: input.domain, err }, "dns fetch failed");
        return {
          success: false,
          cached: false,
          data: null,
          error: "dns_fetch_failed",
        };
      }
    }),

  /**
   * Get hosting, DNS, and email provider data for a domain.
   * Detects providers from DNS records and HTTP headers.
   */
  getHosting: publicProcedure
    .input(DomainInputSchema)
    .use(withDomainAccessUpdate)
    .query(async ({ ctx, input, path }) => {
      const { getCachedHosting } = await import("@domainstack/db/queries");

      // Check cache first — cached reads must not consume the rate-limit budget
      const cached = await getCachedHosting(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

      await rateLimit({ ctx, path, config: LOOKUP_RATE_LIMITS.getHosting });

      // Fetch fresh data
      try {
        const result = await fetchHosting(input.domain);
        return { success: true, cached: false, data: result.data };
      } catch (err) {
        logger.error({ domain: input.domain, err }, "hosting fetch failed");
        return {
          success: false,
          cached: false,
          data: null,
          error: "fetch_failed",
        };
      }
    }),

  /**
   * Get SSL certificates for a domain.
   * Performs TLS handshake to retrieve certificate chain.
   */
  getCertificates: publicProcedure
    .input(DomainInputSchema)
    .use(withDomainAccessUpdate)
    .query(async ({ ctx, input, path }) => {
      const { getCachedCertificates } = await import("@domainstack/db/queries");

      // Check cache first — cached reads must not consume the rate-limit budget
      const cached = await getCachedCertificates(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

      await rateLimit({ ctx, path, config: LOOKUP_RATE_LIMITS.getCertificates });

      // Fetch fresh data
      try {
        const result = await fetchCertificates(input.domain);
        if (result.success === false) {
          return {
            success: false,
            cached: false,
            data: null,
            error: result.error,
          };
        }
        return { success: true, cached: false, data: result.data };
      } catch (err) {
        logger.error({ domain: input.domain, err }, "certificates fetch failed");
        return {
          success: false,
          cached: false,
          data: null,
          error: "fetch_failed",
        };
      }
    }),

  /**
   * Get HTTP headers for a domain.
   * Probes the domain to retrieve response headers.
   */
  getHeaders: publicProcedure
    .input(DomainInputSchema)
    .use(withDomainAccessUpdate)
    .query(async ({ ctx, input, path }) => {
      const { getCachedHeaders } = await import("@domainstack/db/queries");

      // Check cache first — cached reads must not consume the rate-limit budget
      const cached = await getCachedHeaders(input.domain);
      if (cached.data && !cached.stale) {
        return {
          success: true,
          cached: true,
          data: {
            ...cached.data,
            statusMessage: getHttpStatusMessage(cached.data.status),
          },
        };
      }

      await rateLimit({ ctx, path, config: LOOKUP_RATE_LIMITS.getHeaders });

      // Fetch fresh data
      try {
        const result = await fetchHeaders(input.domain);
        if (result.success === false) {
          return {
            success: false,
            cached: false,
            data: null,
            error: result.error,
          };
        }
        return { success: true, cached: false, data: result.data };
      } catch (err) {
        logger.error({ domain: input.domain, err }, "headers fetch failed");
        return {
          success: false,
          cached: false,
          data: null,
          error: "fetch_failed",
        };
      }
    }),

  /**
   * Get SEO data for a domain.
   * Fetches HTML meta tags, robots.txt, and OG images.
   */
  getSeo: publicProcedure
    .input(DomainInputSchema)
    .use(withDomainAccessUpdate)
    .query(async ({ ctx, input, path }) => {
      const { getCachedSeo } = await import("@domainstack/db/queries");

      // Check cache first — cached reads must not consume the rate-limit budget
      const cached = await getCachedSeo(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

      await rateLimit({ ctx, path, config: LOOKUP_RATE_LIMITS.getSeo });

      // Fetch fresh data
      try {
        const result = await fetchSeo(input.domain);
        if (!result.success) {
          return {
            success: false,
            cached: false,
            data: null,
            error: result.error,
          };
        }
        return { success: true, cached: false, data: result.data };
      } catch (err) {
        logger.error({ domain: input.domain, err }, "seo fetch failed");
        return {
          success: false,
          cached: false,
          data: null,
          error: "fetch_failed",
        };
      }
    }),

  /**
   * Get a favicon for a domain.
   * Fetches from multiple sources (Google, DuckDuckGo, direct).
   * Fresh cache hits skip rate limiting so archived lists over the cap still load icons.
   */
  getFavicon: publicProcedure.input(DomainInputSchema).query(async ({ ctx, input, path }) => {
    const { getFavicon: getCachedFavicon } = await import("@domainstack/db/queries");

    // Check cache first — cached reads must not consume the rate-limit budget
    const cached = await getCachedFavicon(input.domain);
    if (cached.data && !cached.stale) {
      return { success: true, cached: true, data: cached.data };
    }

    await rateLimit({ ctx, path, config: LOOKUP_RATE_LIMITS.getFavicon });

    // Fetch fresh data
    try {
      const result = await fetchFavicon(input.domain);
      return { success: true, cached: false, data: result.data };
    } catch (err) {
      logger.error({ domain: input.domain, err }, "favicon fetch failed");
      return {
        success: false,
        cached: false,
        data: null,
        error: "fetch_failed",
      };
    }
  }),
});
