import { SafeFetchError } from "./errors";

/**
 * DNS failure codes that will not resolve on retry.
 *
 * `EAI_AGAIN` is deliberately absent: getaddrinfo returns it for a *temporary*
 * resolver failure, so it must stay retryable.
 */
const PERMANENT_DNS_CODES = new Set(["ENOTFOUND", "ENODATA", "ENOENT"]);

/** What a message must contain to be read as permanent when there is no errno code. */
const PERMANENT_DNS_MESSAGE_SIGNALS = [
  ...[...PERMANENT_DNS_CODES].map((code) => code.toLowerCase()),
  "no dns records found",
  "dns lookup returned no records",
];

/**
 * Message-only fallback for errors that carry no errno code. Permanent only for
 * a known permanent code or a definitive empty answer; anything else, including
 * an unrecognized message, stays retryable. The timeout and EAI_AGAIN guards
 * come first because a hostname in the message could look like a code.
 */
function isPermanentDnsMessage(message: string): boolean {
  if (message.includes("timed out") || message.includes("eai_again")) return false;
  return PERMANENT_DNS_MESSAGE_SIGNALS.some((signal) => message.includes(signal));
}

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
    // known-permanent codes are permanent. Anything else is retryable, whether
    // temporary (EAI_AGAIN, ETIMEDOUT) or unrecognized (EAI_FAIL): retrying is
    // cheap, while caching a wrong permanent verdict is not.
    const causeCode = (err.cause as { code?: unknown } | undefined)?.code;
    if (typeof causeCode === "string") {
      return PERMANENT_DNS_CODES.has(causeCode);
    }
    // No errno (our own timeout, empty answers): fall back to the message.
    return isPermanentDnsMessage(err.message.toLowerCase());
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

  return isPermanentDnsMessage(
    `${err.message} ${errorWithCode.cause?.message ?? ""}`.toLowerCase(),
  );
}
