import type { Section } from "@domainstack/constants";
import { lookupFavicon, lookupSection } from "@domainstack/core/lookup";

import { HostnameInputSchema, RegistrableDomainInputSchema } from "../domain-input";
import { publicProcedure } from "../procedures";
import { rateLimitIdentifier, withTrpcRateLimitErrors } from "../rate-limit";
import { createTRPCRouter } from "../trpc";

/**
 * One procedure per report section: normalize the domain to the section's
 * scope, then let `lookupSection` decide between cache and a metered fresh fetch.
 */
function lookupProcedure<S extends Section>(
  section: S,
  inputSchema: typeof HostnameInputSchema | typeof RegistrableDomainInputSchema,
) {
  return publicProcedure
    .input(inputSchema)
    .query(({ ctx, input }) =>
      withTrpcRateLimitErrors(() =>
        lookupSection(section, input.domain, { identifier: rateLimitIdentifier(ctx) }),
      ),
    );
}

export const domainRouter = createTRPCRouter({
  // Registration belongs to the registrable domain; every other section
  // describes the exact hostname (`api.example.com` stays `api.example.com`).
  getRegistration: lookupProcedure("registration", RegistrableDomainInputSchema),
  getDnsRecords: lookupProcedure("dns", HostnameInputSchema),
  getHosting: lookupProcedure("hosting", HostnameInputSchema),
  getCertificates: lookupProcedure("certificates", HostnameInputSchema),
  getHeaders: lookupProcedure("headers", HostnameInputSchema),
  getSeo: lookupProcedure("seo", HostnameInputSchema),

  /**
   * Get a favicon for a hostname.
   * Fresh cache hits skip rate limiting so archived lists over the cap still load icons.
   */
  getFavicon: publicProcedure
    .input(HostnameInputSchema)
    .query(({ ctx, input }) =>
      withTrpcRateLimitErrors(() =>
        lookupFavicon(input.domain, { identifier: rateLimitIdentifier(ctx) }),
      ),
    ),
});
