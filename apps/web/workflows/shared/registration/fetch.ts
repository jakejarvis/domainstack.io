/**
 * Registration fetch step.
 *
 * Performs WHOIS/RDAP lookup for a domain.
 * This step is shared between the dedicated registrationWorkflow and internal workflows.
 */

import { RetryableError } from "workflow";
import type { FetchRegistrationResult } from "./types";

/**
 * Step: Lookup domain registration via rdapper (WHOIS/RDAP).
 *
 * Unsupported TLD and lookup_failed are permanent failures.
 * Retry and timeout errors are thrown as RetryableError for automatic retry.
 *
 * @param domain - The domain to lookup
 * @returns FetchRegistrationResult with typed error on failure
 */
export async function lookupWhoisStep(
  domain: string,
): Promise<FetchRegistrationResult> {
  "use step";

  // Dynamic import to keep step bundle small
  const { lookupWhois } = await import("@domainstack/core/whois");

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
