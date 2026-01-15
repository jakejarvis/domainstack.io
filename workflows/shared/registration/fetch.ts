/**
 * Registration fetch step.
 *
 * Performs WHOIS/RDAP lookup for a domain.
 * This step is shared between the dedicated registrationWorkflow and internal workflows.
 */

import { RetryableError } from "workflow";
import type { FetchRegistrationResult, RdapLookupResult } from "./types";

/**
 * RDAP Bootstrap Registry URL from IANA.
 * This JSON file maps TLDs to their authoritative RDAP servers.
 * @see https://datatracker.ietf.org/doc/html/rfc7484
 */
const RDAP_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";

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

  // Dynamic imports for Node.js modules
  const { lookup } = await import("rdapper");
  const { createLogger } = await import("@/lib/logger/server");
  const { USER_AGENT } = await import("@/lib/constants/app");

  const logger = createLogger({ source: "registration-fetch" });

  // Fetch RDAP bootstrap data with Next.js Data Cache (1 week TTL)
  const bootstrapRes = await fetch(RDAP_BOOTSTRAP_URL, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 604_800 }, // 1 week
  });

  if (!bootstrapRes.ok) {
    logger.warn(
      { status: bootstrapRes.status },
      "Failed to fetch RDAP bootstrap, using rdapper default",
    );
  }

  const bootstrapData = bootstrapRes.ok ? await bootstrapRes.json() : undefined;

  // Inline lookupRdap logic
  const result = await (async (): Promise<RdapLookupResult> => {
    try {
      const { ok, record, error } = await lookup(domain, {
        timeoutMs: 5000,
        customBootstrapData: bootstrapData,
        includeRaw: true,
      });

      if (!ok || !record) {
        const isUnsupported = isExpectedRegistrationError(error);
        const isTimeout = isTimeoutError(error);

        if (isUnsupported) {
          logger.info({ domain, err: error }, "unsupported TLD");
          return { success: false, error: "unsupported_tld" };
        }

        if (isTimeout) {
          logger.warn({ domain, err: error }, "RDAP timeout");
          return { success: false, error: "timeout" };
        }

        logger.warn({ err: error, domain }, "rdap lookup failed");
        return { success: false, error: "retry" };
      }

      return { success: true, recordJson: JSON.stringify(record) };
    } catch (err) {
      logger.warn({ err, domain }, "rdap lookup threw");
      return { success: false, error: "retry" };
    }
  })();

  if (!result.success) {
    // Both retry and timeout should trigger retries
    if (result.error === "retry") {
      throw new RetryableError("RDAP lookup failed", { retryAfter: "5s" });
    }
    if (result.error === "timeout") {
      throw new RetryableError("RDAP lookup timed out", { retryAfter: "10s" });
    }
    // Permanent failure - preserve the actual error
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { recordJson: result.recordJson },
  };
}

// Helper functions (pure, no Node.js dependencies)
function isExpectedRegistrationError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();

  return (
    errorStr.includes("no whois server discovered") ||
    errorStr.includes("no rdap server found") ||
    errorStr.includes("registry may not publish public whois") ||
    errorStr.includes("tld is not supported") ||
    errorStr.includes("no whois server configured")
  );
}

function isTimeoutError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();
  return (
    errorStr.includes("whois socket timeout") ||
    errorStr.includes("whois timeout") ||
    errorStr.includes("rdap timeout")
  );
}
