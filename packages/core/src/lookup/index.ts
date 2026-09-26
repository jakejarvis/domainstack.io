/**
 * Domain lookups — the one place that decides "cached, or rate-limit and fetch".
 *
 * Shared by the tRPC routers and the chat tools. Callers pass an
 * already-normalized name at the section's scope (see {@link SectionSpec.scope})
 * to look up and an identifier to meter (user id
 * or IP); everything else — cache read, rate limit, fetch, error normalization,
 * and recording that a domain was looked up — lives here. The warm-domains
 * workflow uses {@link fetchSection} to refresh a section regardless of cache
 * state.
 *
 * Every import of a db query or service is dynamic: this module is reached from
 * workflow code, where Node-only dependencies must stay out of the sandbox bundle.
 */

import type { Section } from "@domainstack/constants";
import { createLogger } from "@domainstack/logger";
import { enforceRateLimit } from "@domainstack/redis/enforce";
import type { RateLimitConfig } from "@domainstack/redis/ratelimit";
import type {
  CertificatesResponse,
  DnsRecordsResponse,
  FaviconResponse,
  HeadersResponse,
  HostingResponse,
  ProviderLogoResponse,
  RegistrationResponse,
  SeoResponse,
} from "@domainstack/types";

import type { HeadersError } from "../headers/types";
import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import type { SeoError } from "../seo";
import type { CertificatesError } from "../tls";
import type { RegistrationError } from "../whois";

const logger = createLogger({ source: "lookup" });

interface SectionDataMap {
  registration: RegistrationResponse;
  dns: DnsRecordsResponse;
  hosting: HostingResponse;
  certificates: CertificatesResponse;
  headers: HeadersResponse;
  seo: SeoResponse;
}

/** Why a section could not be produced. `fetch_failed` covers unexpected/transient failures. */
export type LookupError =
  | RegistrationError
  | HeadersError
  | CertificatesError
  | SeoError
  | "fetch_failed";

export type LookupOutcome<T> =
  | { success: true; cached: boolean; data: T }
  | { success: false; error: LookupError };

export type LookupResult<S extends Section> = LookupOutcome<SectionDataMap[S]>;

type FetchOutcome<T> = { success: true; data: T } | { success: false; error: LookupError };

/** The slice of the db layer's `CacheResult` this module reads. */
interface Cached<T> {
  data: T | null;
  stale: boolean;
}

interface SectionSpec<S extends Section> {
  /**
   * What name the section is keyed by: `registrable` sections (registration)
   * only accept a registrable domain, never a subdomain; `hostname` sections
   * describe the exact hostname, which may be a subdomain.
   */
  scope: "registrable" | "hostname";
  /** Budget per identifier, consumed only when the cache can't answer. */
  limit: RateLimitConfig;
  getCached: (domain: string) => Promise<Cached<SectionDataMap[S]>>;
  /** Fetch fresh data and persist it. Services either return a typed failure or throw. */
  fetch: (domain: string) => Promise<FetchOutcome<SectionDataMap[S]>>;
}

const SECTIONS: { [S in Section]: SectionSpec<S> } = {
  registration: {
    scope: "registrable",
    limit: { requests: 30, window: "1 m" },
    getCached: async (domain) =>
      (await import("@domainstack/db/queries/registrations")).getCachedRegistration(domain),
    fetch: async (domain) => (await import("../whois")).fetchRegistration(domain),
  },
  dns: {
    scope: "hostname",
    limit: { requests: 60, window: "1 m" },
    getCached: async (domain) => (await import("@domainstack/db/queries/dns")).getCachedDns(domain),
    fetch: async (domain) => (await import("../dns")).fetchDns(domain),
  },
  hosting: {
    scope: "hostname",
    limit: { requests: 30, window: "1 m" },
    getCached: async (domain) =>
      (await import("@domainstack/db/queries/hosting")).getCachedHosting(domain),
    fetch: async (domain) => (await import("../hosting")).fetchHosting(domain),
  },
  certificates: {
    scope: "hostname",
    limit: { requests: 30, window: "1 m" },
    getCached: async (domain) =>
      (await import("@domainstack/db/queries/certificates")).getCachedCertificates(domain),
    fetch: async (domain) => (await import("../tls")).fetchCertificates(domain),
  },
  headers: {
    scope: "hostname",
    limit: { requests: 60, window: "1 m" },
    getCached: async (domain) => {
      const { getCachedHeaders } = await import("@domainstack/db/queries/headers");
      const { getHttpStatusMessage } = await import("../headers/status-message");
      // The db layer stores only the numeric status; attach the reason phrase here.
      const cached = await getCachedHeaders(domain);
      return {
        ...cached,
        data: cached.data && {
          ...cached.data,
          statusMessage: getHttpStatusMessage(cached.data.status),
        },
      };
    },
    fetch: async (domain) => (await import("../headers")).fetchHeaders(domain),
  },
  seo: {
    scope: "hostname",
    limit: { requests: 30, window: "1 m" },
    getCached: async (domain) => (await import("@domainstack/db/queries/seo")).getCachedSeo(domain),
    fetch: async (domain) => (await import("../seo")).fetchSeo(domain),
  },
};

/**
 * Refuse a name outside the section's scope, so registration data is never
 * fetched for, or persisted under, a subdomain's row.
 *
 * @throws Error when a registrable-scoped section gets anything but a registrable domain
 */
async function assertSectionScope(section: Section, domain: string): Promise<void> {
  if (SECTIONS[section].scope !== "registrable") return;
  const { toRegistrableDomain } = await import("@domainstack/utils/domain");
  if (toRegistrableDomain(domain) !== domain) {
    throw new Error(`${section} is keyed by registrable domain; got "${domain}"`);
  }
}

/**
 * Fetch and persist a section, bypassing the cache and rate limit.
 *
 * @throws Error on transient failures (unreachable host, provider outage), or
 * when `domain` is outside the section's scope
 */
export async function fetchSection<S extends Section>(
  section: S,
  rawDomain: string,
): Promise<FetchOutcome<SectionDataMap[S]>> {
  // Same key `lookupSection` reads, so what's stored here is what's found there.
  const domain = rawDomain.toLowerCase();
  await assertSectionScope(section, domain);
  return SECTIONS[section].fetch(domain);
}

interface LookupOptions {
  /** Who to meter (user id or IP). Unmetered when missing (fail-open). */
  identifier?: string | null;
}

/**
 * Serve `cached` when it's fresh; otherwise enforce the rate limit and fetch.
 *
 * A fresh hit never consumes the limit. Fetch failures come back as
 * `{ success: false, error }`; only rate-limit rejections throw
 * (`RateLimitError` from `@domainstack/redis/enforce`).
 */
async function resolveLookup<T>({
  cached,
  meter,
  fetch,
  log,
}: {
  cached: { data: T | null; stale: boolean };
  meter: { key: string; identifier?: string | null; config: RateLimitConfig };
  fetch: () => Promise<FetchOutcome<T>>;
  log: { label: string; fields: Record<string, unknown>; unavailableLevel?: "warn" | "debug" };
}): Promise<LookupOutcome<T>> {
  if (cached.data && !cached.stale) {
    return { success: true, cached: true, data: cached.data };
  }

  await enforceRateLimit(meter);

  try {
    const result = await fetch();
    return result.success
      ? { success: true, cached: false, data: result.data }
      : { success: false, error: result.error };
  } catch (err) {
    // A remote that can't supply data is routine; anything else is a bug.
    if (err instanceof RemoteDataUnavailableError) {
      logger[log.unavailableLevel ?? "warn"]({ ...log.fields, err }, `${log.label} unavailable`);
    } else {
      logger.error({ ...log.fields, err }, `${log.label} failed unexpectedly`);
    }
    return { success: false, error: "fetch_failed" };
  }
}

/**
 * Look up one report section at its scope (registrable domain for
 * registration, exact hostname for the rest), and record that the name was
 * accessed (it feeds the warm-domains recency window).
 *
 * @throws Error when `rawDomain` is outside the section's scope
 */
export async function lookupSection<S extends Section>(
  section: S,
  rawDomain: string,
  { identifier }: LookupOptions = {},
): Promise<LookupResult<S>> {
  const { limit, getCached, fetch } = SECTIONS[section];
  // Rows are stored under the lowercased name, so read and fetch with that key.
  const domain = rawDomain.toLowerCase();
  await assertSectionScope(section, domain);

  // Fire-and-forget: `updateLastAccessed` never throws, and `waitUntil` keeps
  // the write alive after the response on Vercel.
  const { waitUntil } = await import("@vercel/functions");
  const { updateLastAccessed } = await import("@domainstack/db/queries/domains");
  waitUntil(updateLastAccessed(domain));

  return resolveLookup({
    cached: await getCached(domain),
    meter: { key: `lookup.${section}`, identifier, config: limit },
    fetch: () => fetch(domain),
    log: { label: section, fields: { domain, section } },
  });
}

/** Look up a domain's favicon. Unlike sections, this does not record access. */
export async function lookupFavicon(
  rawDomain: string,
  { identifier }: LookupOptions = {},
): Promise<LookupOutcome<FaviconResponse>> {
  const domain = rawDomain.toLowerCase();
  const { getFavicon } = await import("@domainstack/db/queries/favicons");
  const { fetchFavicon } = await import("../favicon");

  return resolveLookup({
    cached: await getFavicon(domain),
    meter: { key: "lookup.favicon", identifier, config: { requests: 100, window: "1 m" } },
    fetch: () => fetchFavicon(domain),
    log: { label: "favicon", fields: { domain }, unavailableLevel: "debug" },
  });
}

/** Look up a provider's logo. A provider without a domain has no logo, without metering. */
export async function lookupProviderLogo(
  providerId: string,
  { identifier }: LookupOptions = {},
): Promise<LookupOutcome<ProviderLogoResponse>> {
  const { getProviderById } = await import("@domainstack/db/queries/providers");
  const { getProviderLogo } = await import("@domainstack/db/queries/provider-logos");
  const { fetchProviderLogo } = await import("../provider-logo");

  const [provider, cached] = await Promise.all([
    getProviderById(providerId),
    getProviderLogo(providerId),
  ]);
  const providerDomain = provider?.domain;
  if (!providerDomain) {
    // Same shape as the service's "no logo found" result; bails before the rate limit.
    return { success: true, cached: false, data: { url: null } };
  }

  return resolveLookup({
    cached,
    meter: { key: "lookup.providerLogo", identifier, config: { requests: 60, window: "1 m" } },
    fetch: () => fetchProviderLogo(providerId, providerDomain),
    log: { label: "provider logo", fields: { providerId }, unavailableLevel: "debug" },
  });
}
