import { createLogger } from "@domainstack/logger";
import {
  fetchCertificates,
  fetchDns,
  fetchFavicon,
  fetchHeaders,
  fetchHosting,
  fetchRegistration,
  fetchSeo,
} from "@domainstack/server";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { toRegistrableDomain } from "@/lib/normalize-domain";
import {
  createTRPCRouter,
  publicProcedure,
  withDomainAccessUpdate,
  withRateLimit,
} from "@/trpc/init";

const logger = createLogger({ source: "domain-router" });

const DomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => {
    const registrable = toRegistrableDomain(domain);
    if (!registrable) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          '"domain" must be a valid registrable domain (e.g., example.com)',
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
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 30, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedRegistration } = await import("@domainstack/db/queries");

      // Check cache first
      const cached = await getCachedRegistration(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

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
        logger.error(
          { domain: input.domain, err },
          "registration fetch failed",
        );
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
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 60, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedDns } = await import("@domainstack/db/queries");

      // Check cache first
      const cached = await getCachedDns(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

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
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 30, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedHosting } = await import("@domainstack/db/queries");

      // Check cache first
      const cached = await getCachedHosting(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

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
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 30, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedCertificates } = await import("@domainstack/db/queries");

      // Check cache first
      const cached = await getCachedCertificates(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

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
        logger.error(
          { domain: input.domain, err },
          "certificates fetch failed",
        );
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
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 60, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedHeaders } = await import("@domainstack/db/queries");

      // Check cache first
      const cached = await getCachedHeaders(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

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
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 30, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedSeo } = await import("@domainstack/db/queries");

      // Check cache first
      const cached = await getCachedSeo(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

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
   */
  getFavicon: publicProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getFavicon: getCachedFavicon } = await import(
        "@domainstack/db/queries"
      );

      // Check cache first
      const cached = await getCachedFavicon(input.domain);
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, data: cached.data };
      }

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
