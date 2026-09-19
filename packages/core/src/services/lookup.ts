/**
 * Domain section lookup — the one place that decides "cached, or rate-limit
 * and fetch" for a report section.
 *
 * Shared by the tRPC domain router and the chat tools. Callers pass an
 * already-normalized registrable domain and an identifier to meter (user id or
 * IP); everything else — cache read, per-section rate limit, fetch, error
 * normalization — lives here. The warm-domains workflow uses {@link fetchSection}
 * to refresh a section regardless of cache state.
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
  HeadersResponse,
  HostingResponse,
  RegistrationResponse,
  SeoResponse,
} from "@domainstack/types";

import type { CertificatesError } from "./certificates";
import { RemoteDataUnavailableError } from "./fetch-errors";
import type { HeadersError } from "./headers";
import type { RegistrationError } from "./registration";
import type { SeoError } from "./seo";

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

export type LookupResult<S extends Section> =
  | { success: true; cached: boolean; data: SectionDataMap[S] }
  | { success: false; error: LookupError };

type FetchOutcome<S extends Section> =
  | { success: true; data: SectionDataMap[S] }
  | { success: false; error: LookupError };

/** The slice of the db layer's `CacheResult` this module reads. */
interface Cached<T> {
  data: T | null;
  stale: boolean;
}

interface SectionSpec<S extends Section> {
  /** Budget per identifier, consumed only when the cache can't answer. */
  limit: RateLimitConfig;
  getCached: (domain: string) => Promise<Cached<SectionDataMap[S]>>;
  /** Fetch fresh data and persist it. Services either return a typed failure or throw. */
  fetch: (domain: string) => Promise<FetchOutcome<S>>;
}

const SECTIONS: { [S in Section]: SectionSpec<S> } = {
  registration: {
    limit: { requests: 30, window: "1 m" },
    getCached: async (domain) =>
      (await import("@domainstack/db/queries/registrations")).getCachedRegistration(domain),
    fetch: async (domain) => (await import("./registration")).fetchRegistration(domain),
  },
  dns: {
    limit: { requests: 60, window: "1 m" },
    getCached: async (domain) => (await import("@domainstack/db/queries/dns")).getCachedDns(domain),
    fetch: async (domain) => (await import("./dns")).fetchDns(domain),
  },
  hosting: {
    limit: { requests: 30, window: "1 m" },
    getCached: async (domain) =>
      (await import("@domainstack/db/queries/hosting")).getCachedHosting(domain),
    fetch: async (domain) => (await import("./hosting")).fetchHosting(domain),
  },
  certificates: {
    limit: { requests: 30, window: "1 m" },
    getCached: async (domain) =>
      (await import("@domainstack/db/queries/certificates")).getCachedCertificates(domain),
    fetch: async (domain) => (await import("./certificates")).fetchCertificates(domain),
  },
  headers: {
    limit: { requests: 60, window: "1 m" },
    getCached: async (domain) => {
      const { getCachedHeaders } = await import("@domainstack/db/queries/headers");
      const { getHttpStatusMessage } = await import("./headers");
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
    fetch: async (domain) => (await import("./headers")).fetchHeaders(domain),
  },
  seo: {
    limit: { requests: 30, window: "1 m" },
    getCached: async (domain) => (await import("@domainstack/db/queries/seo")).getCachedSeo(domain),
    fetch: async (domain) => (await import("./seo")).fetchSeo(domain),
  },
};

/**
 * Fetch and persist a section, bypassing the cache and rate limit.
 *
 * @throws Error on transient failures (unreachable host, provider outage)
 */
export function fetchSection<S extends Section>(
  section: S,
  domain: string,
): Promise<FetchOutcome<S>> {
  return SECTIONS[section].fetch(domain);
}

/**
 * Look up one report section for a registrable domain.
 *
 * Fresh cache hits are returned without consuming the rate limit. Otherwise the
 * section's limit is enforced for `identifier` (fail-open when it's missing) and
 * fresh data is fetched. Failures come back as `{ success: false, error }`;
 * only rate-limit rejections throw (`RateLimitError` from `@domainstack/redis/enforce`).
 */
export async function lookupSection<S extends Section>(
  section: S,
  domain: string,
  { identifier }: { identifier?: string | null } = {},
): Promise<LookupResult<S>> {
  const { limit, getCached, fetch } = SECTIONS[section];

  const cached = await getCached(domain);
  if (cached.data && !cached.stale) {
    return { success: true, cached: true, data: cached.data };
  }

  await enforceRateLimit({ key: `lookup.${section}`, identifier, config: limit });

  try {
    const result = await fetch(domain);
    return result.success
      ? { success: true, cached: false, data: result.data }
      : { success: false, error: result.error };
  } catch (err) {
    // A remote target that can't supply data is routine; anything else is a bug.
    if (err instanceof RemoteDataUnavailableError) {
      logger.warn({ domain, section, err }, "section unavailable");
    } else {
      logger.error({ domain, section, err }, "section failed unexpectedly");
    }
    return { success: false, error: "fetch_failed" };
  }
}
