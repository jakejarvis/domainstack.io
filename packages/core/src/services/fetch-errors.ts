import {
  isExpectedDnsError,
  SafeFetchError,
  type SafeFetchErrorCode,
} from "@domainstack/safe-fetch";

/**
 * A remote domain or provider could not supply data, but the application is
 * otherwise healthy. Routers use this boundary to keep target-specific
 * failures separate from persistence, parsing, and other internal failures.
 */
export class RemoteDataUnavailableError extends Error {
  readonly name = "RemoteDataUnavailableError";
}

/**
 * Failures that mean "this URL will never serve us an asset", as opposed to
 * "the attempt failed this time". Retrying any of these produces the same
 * result, so callers record a permanent not-found instead of scheduling work.
 */
const DEFINITIVE_CODES = new Set<SafeFetchErrorCode>([
  "host_blocked",
  "host_not_allowed",
  "private_ip",
  "protocol_not_allowed",
  "invalid_url",
]);

/**
 * True when an asset fetch failed for a reason that will not change on retry.
 *
 * Shared by the favicon and provider-logo services, which make the same
 * permanent-versus-transient call and previously each kept their own copy.
 */
export function isDefinitiveNotFoundError(err: unknown): boolean {
  if (!(err instanceof SafeFetchError)) return false;

  // safe-fetch also raises dns_error for lookup timeouts, which are transient.
  if (err.code === "dns_error") return isExpectedDnsError(err);

  return DEFINITIVE_CODES.has(err.code);
}
