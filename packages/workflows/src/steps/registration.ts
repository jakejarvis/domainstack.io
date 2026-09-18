import { RetryableError } from "workflow";

import type { RegistrationResponse } from "@domainstack/types";

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

/**
 * Step: Normalize registrar and build response.
 *
 * @param recordJson - JSON-serialized RDAP/WHOIS record
 * @returns Normalized RegistrationResponse
 */
export async function normalizeAndBuildResponseStep(
  recordJson: string,
): Promise<RegistrationResponse> {
  "use step";

  const { getProviderCatalog } = await import("@domainstack/catalog");
  const { normalizeRegistration } = await import("@domainstack/core/services/registration");
  return await normalizeRegistration(recordJson, { catalog: await getProviderCatalog() });
}

/**
 * Step: Persist registration to database.
 *
 * @param domain - The domain name
 * @param response - The normalized registration response
 */
export async function persistRegistrationStep(
  domain: string,
  response: RegistrationResponse,
): Promise<void> {
  "use step";

  const { persistRegistration } = await import("@domainstack/core/services/registration");
  try {
    await persistRegistration(domain, response);
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, { context: `persisting registration for ${domain}` });
  }
}
