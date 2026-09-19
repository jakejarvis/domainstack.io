import { SafeFetchError } from "./errors";

/**
 * DNS failure codes that will not resolve on retry.
 *
 * `EAI_AGAIN` is deliberately absent: getaddrinfo returns it for a *temporary*
 * resolver failure, so it must stay retryable.
 */
const PERMANENT_DNS_CODES = new Set(["ENOTFOUND", "ENODATA", "ENOENT"]);

/**
 * Check if an error is an expected DNS failure (NXDOMAIN, missing A/AAAA, etc).
 *
 * These are permanent: retrying will not make the name resolve. DNS lookup
 * timeouts and temporary resolver failures are excluded so callers can retry
 * them.
 */
export function isExpectedDnsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  // SafeFetchError uses code "dns_error" for NXDOMAIN, empty answers, and
  // wrapped resolver failures. Timeouts and temporary resolver failures stay
  // retryable.
  if (err instanceof SafeFetchError && err.code === "dns_error") {
    // A wrapped resolver error carries its errno code as the cause: only the
    // known-permanent codes are permanent, so any other (EAI_AGAIN, EAI_FAIL,
    // ETIMEDOUT, ...) is retryable without needing to list each one.
    const causeCode = (err.cause as { code?: unknown } | undefined)?.code;
    if (typeof causeCode === "string") {
      return PERMANENT_DNS_CODES.has(causeCode);
    }
    // No errno (our own timeout, empty answers): fall back to the message.
    const message = err.message.toLowerCase();
    return !message.includes("timed out") && !message.includes("eai_again");
  }

  const errorWithCode = err as Error & {
    code?: string;
    cause?: { code?: string; message?: string };
  };
  const code = errorWithCode.code ?? errorWithCode.cause?.code;
  if (code === "EAI_AGAIN") {
    return false;
  }
  if (code && PERMANENT_DNS_CODES.has(code)) {
    return true;
  }

  const message = `${err.message} ${errorWithCode.cause?.message ?? ""}`.toLowerCase();
  if (message.includes("eai_again")) {
    return false;
  }
  return (
    message.includes("enotfound") ||
    message.includes("getaddrinfo") ||
    message.includes("dns lookup failed") ||
    message.includes("no dns records found") ||
    message.includes("dns lookup returned no records")
  );
}
