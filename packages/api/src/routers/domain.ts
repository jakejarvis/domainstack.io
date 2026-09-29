import type { Section } from "@domainstack/constants";
import { type LookupResult, lookupFavicon, lookupSection } from "@domainstack/core/lookup";
import { getFreshProviderLogoUrls } from "@domainstack/db/queries/provider-logos";
import { getRegistrationRawResponse } from "@domainstack/db/queries/registrations";
import type { ProviderRef } from "@domainstack/types";

import { DomainInputSchema } from "../domain-input";
import { publicProcedure } from "../procedures";
import { rateLimit, rateLimitIdentifier, withTrpcRateLimitErrors } from "../rate-limit";
import { createTRPCRouter } from "../trpc";

type SectionData<S extends Section> = Extract<LookupResult<S>, { success: true }>["data"];

/** Copy a ref with its cached logo URL attached (tri-state; see ProviderRef.logoUrl). */
function withLogo(ref: ProviderRef, logos: Map<string, string | null>): ProviderRef {
  if (!ref.id || !logos.has(ref.id)) return ref;
  return { ...ref, logoUrl: logos.get(ref.id) };
}

/**
 * One procedure per report section: normalize the domain, then let
 * `lookupSection` decide between cache and a metered fresh fetch.
 *
 * `attachLogos` adds fresh cached provider logo URLs to a successful result after
 * the lookup, so cached and fresh results get them alike and core's payloads stay as-is.
 */
function lookupProcedure<S extends Section>(
  section: S,
  attachLogos?: {
    /** Provider ids to look up (nulls are ignored). */
    ids: (data: SectionData<S>) => Array<string | null>;
    /** Return a copy of `data` with `withLogo` applied to each ref. */
    apply: (data: SectionData<S>, logos: Map<string, string | null>) => SectionData<S>;
  },
) {
  return publicProcedure
    .input(DomainInputSchema)
    .query(async ({ ctx, input }): Promise<LookupResult<S>> => {
      const result = await withTrpcRateLimitErrors(() =>
        lookupSection(section, input.domain, { identifier: rateLimitIdentifier(ctx) }),
      );
      if (!attachLogos || !result.success) return result;
      const ids = [...new Set(attachLogos.ids(result.data).filter((id): id is string => !!id))];
      const logos = await getFreshProviderLogoUrls(ids);
      return { ...result, data: attachLogos.apply(result.data, logos) };
    });
}

export const domainRouter = createTRPCRouter({
  getRegistration: lookupProcedure("registration", {
    ids: (d) => [d.registrarProvider.id],
    apply: (d, logos) => ({ ...d, registrarProvider: withLogo(d.registrarProvider, logos) }),
  }),
  getDnsRecords: lookupProcedure("dns"),
  getHosting: lookupProcedure("hosting", {
    ids: (d) => [d.dnsProvider.id, d.hostingProvider.id, d.emailProvider.id],
    apply: (d, logos) => ({
      ...d,
      dnsProvider: withLogo(d.dnsProvider, logos),
      hostingProvider: withLogo(d.hostingProvider, logos),
      emailProvider: withLogo(d.emailProvider, logos),
    }),
  }),
  getCertificates: lookupProcedure("certificates", {
    ids: (d) => d.certificates.map((c) => c.caProvider.id),
    apply: (d, logos) => ({
      ...d,
      certificates: d.certificates.map((c) => ({
        ...c,
        caProvider: withLogo(c.caProvider, logos),
      })),
    }),
  }),
  getHeaders: lookupProcedure("headers"),
  getSeo: lookupProcedure("seo"),

  /** Raw RDAP/WHOIS data for the report's raw-data dialog (cache only, never fetches). */
  getRawRegistration: publicProcedure
    .input(DomainInputSchema)
    .query(async ({ ctx, input, path }) => {
      await rateLimit({ ctx, path, config: { requests: 30, window: "1 m" } });
      return getRegistrationRawResponse(input.domain.toLowerCase());
    }),

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
