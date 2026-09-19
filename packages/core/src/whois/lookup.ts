/**
 * WHOIS/RDAP lookup using rdapper.
 */

import { type BootstrapData, type LookupResult, lookup } from "rdapper";

import type { RdapLookupFailure, RdapLookupResult, WhoisLookupOptions } from "./types";
import { RDAP_BOOTSTRAP_URL } from "./types";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_DEADLINE_MS = 10_000;

/**
 * Map an rdapper failure onto our result codes using its `errorCode`.
 *
 * `no_server` (IANA answered, no WHOIS server exists) and `blocked` (the WHOIS
 * server refuses this client outright) are permanent: neither will succeed on
 * retry, so both surface as `unsupported_tld`. A failed IANA query surfaces
 * as `timeout` or `connect_failed`, so it retries instead of being mistaken
 * for an unsupported TLD. `rate_limited` (throttle notice or RDAP 429) and
 * `unparseable` (a reply with no recognizable record) are treated as
 * transient, so they are retried rather than persisted.
 */
function toFailure(
  res: Pick<
    LookupResult,
    "error" | "errorCode" | "errorPhase" | "errorServer" | "retryAfterMs" | "attempts"
  >,
): RdapLookupFailure {
  const error =
    res.errorCode === "no_server" || res.errorCode === "blocked"
      ? "unsupported_tld"
      : res.errorCode === "timeout"
        ? "timeout"
        : "retry";
  return {
    success: false,
    error,
    detail: {
      message: res.error,
      code: res.errorCode,
      phase: res.errorPhase,
      server: res.errorServer,
      retryAfterMs: res.retryAfterMs,
      attempts: res.attempts,
    },
  };
}

/**
 * Fetch RDAP bootstrap data from IANA.
 *
 * When running in Next.js, this uses the Data Cache with 1 week TTL.
 * In other environments, the `next` option is safely ignored.
 *
 * @param userAgent - User agent for the request
 * @returns Bootstrap data or undefined if fetch fails
 */
export async function fetchBootstrapData(
  userAgent?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<BootstrapData | undefined> {
  try {
    const res = await fetch(RDAP_BOOTSTRAP_URL, {
      headers: userAgent ? { "User-Agent": userAgent } : undefined,
      // Runs before rdapper's own timers start, so it needs its own bound
      signal: AbortSignal.timeout(timeoutMs),
      // Next.js Data Cache - 1 week TTL (ignored in non-Next.js environments)
      next: { revalidate: 604_800 },
    } as RequestInit);

    if (!res.ok) {
      return undefined;
    }

    // rdapper throws on malformed bootstrap data, so treat a bad shape like a failed fetch
    const json = (await res.json()) as Partial<BootstrapData> | null;
    return Array.isArray(json?.services) ? (json as BootstrapData) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Lookup domain registration via rdapper (WHOIS/RDAP).
 *
 * @param domain - The domain to lookup
 * @param options - Lookup options
 * @returns RdapLookupResult with record JSON or error
 */
export async function lookupWhois(
  domain: string,
  options: WhoisLookupOptions = {},
): Promise<RdapLookupResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const includeRaw = options.includeRaw ?? true;

  // Use provided bootstrap data or fetch it
  const bootstrapData =
    (options.customBootstrapData as BootstrapData | undefined) ??
    (await fetchBootstrapData(options.userAgent, timeoutMs));

  try {
    const res = await lookup(domain, {
      timeoutMs,
      deadlineMs,
      includeRaw,
      // rdapper throws on the mere presence of this key, even when undefined, so omit it when our
      // fetch failed and let rdapper load its own bootstrap (or fall back to WHOIS).
      ...(bootstrapData ? { customBootstrapData: bootstrapData } : {}),
    });

    if (!res.ok || !res.record) {
      return toFailure(res);
    }

    return { success: true, recordJson: JSON.stringify(res.record) };
  } catch (err) {
    return toFailure({
      error: err instanceof Error ? err.message : String(err),
      attempts: [],
    });
  }
}
