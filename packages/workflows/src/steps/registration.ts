import { RetryableError } from "workflow";

import type { RegistrationResponse } from "@domainstack/types";

/** Default delay before retrying a failed lookup, and the floor for a server-requested one. */
const RETRY_DELAY_MS = 5_000;
const TIMEOUT_RETRY_DELAY_MS = 10_000;
/** Upper bound on a server-requested back-off, so a huge `Retry-After` cannot stall a run. */
const MAX_RETRY_AFTER_MS = 5 * 60_000;

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

  const { createLogger } = await import("@domainstack/logger");
  const logger = createLogger({ source: "workflows/registration" });

  const result = await lookupWhois(domain, {
    userAgent: process.env.EXTERNAL_USER_AGENT,
  });

  if (!result.success) {
    // Retry and timeout trigger workflow retries
    if (result.error === "retry" || result.error === "timeout") {
      const { message, code, phase, server, retryAfterMs, attempts } = result.detail;
      logger.warn(
        {
          domain,
          outcome: result.error,
          errorCode: code,
          errorPhase: phase,
          errorServer: server,
          retryAfterMs,
          attempts,
        },
        message ?? "WHOIS lookup failed",
      );

      // Honor a server-requested back-off, within [default, MAX_RETRY_AFTER_MS]
      const floor = result.error === "retry" ? RETRY_DELAY_MS : TIMEOUT_RETRY_DELAY_MS;
      const retryAfter = Math.min(Math.max(retryAfterMs ?? 0, floor), MAX_RETRY_AFTER_MS);

      if (result.error === "retry") {
        throw new RetryableError("RDAP lookup failed", { retryAfter });
      }
      throw new RetryableError("RDAP lookup timed out", { retryAfter });
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

  const { getProviderCatalog } = await import("@domainstack/edge-config");
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
