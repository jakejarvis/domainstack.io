import { RetryableError } from "workflow";

type FetchRegistrationResult =
  | { success: true; data: { recordJson: string } }
  | { success: false; error: "unsupported_tld" };

/**
 * Step: Lookup domain registration via rdapper (WHOIS/RDAP).
 *
 * Unsupported TLD is a permanent failure.
 * Retry and timeout errors are thrown as RetryableError for automatic retry.
 *
 * @param domain - The domain to lookup
 * @returns FetchRegistrationResult with typed error on failure
 */
export async function lookupWhoisStep(domain: string): Promise<FetchRegistrationResult> {
  "use step";

  // Dynamic import to keep step bundle small
  const { lookupWhois } = await import("@domainstack/server/whois");

  const result = await lookupWhois(domain, {
    userAgent: process.env.EXTERNAL_USER_AGENT,
  });

  if (!result.success) {
    // Retry and timeout trigger workflow retries
    if (result.error === "retry") {
      throw new RetryableError("RDAP lookup failed", { retryAfter: "5s" });
    }
    if (result.error === "timeout") {
      throw new RetryableError("RDAP lookup timed out", { retryAfter: "10s" });
    }
    // Permanent failure (unsupported_tld) - return to caller
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { recordJson: result.recordJson },
  };
}
