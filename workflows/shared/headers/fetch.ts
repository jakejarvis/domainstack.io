/**
 * Headers fetch step.
 *
 * Fetches HTTP headers from a domain.
 * This step is shared between the dedicated headersWorkflow and internal workflows.
 */

import { RetryableError } from "workflow";
import type { Header } from "@/lib/types/domain/headers";
import type { FetchHeadersResult } from "./types";

const REQUEST_TIMEOUT_MS = 5000;

interface HeadersFetchInternalSuccess {
  success: true;
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

interface HeadersFetchInternalFailure {
  success: false;
  error: "dns_error" | "tls_error" | "fetch_error";
  headers: Header[];
  status: number;
  statusMessage: string | undefined;
}

type HeadersFetchInternalResult =
  | HeadersFetchInternalSuccess
  | HeadersFetchInternalFailure;

/**
 * Step: Fetch HTTP headers from the domain.
 *
 * DNS and TLS errors are permanent failures.
 * fetch_error is thrown as RetryableError for automatic retry.
 *
 * @param domain - The domain to probe
 * @returns FetchHeadersResult with typed error on failure
 */
export async function fetchHeadersStep(
  domain: string,
): Promise<FetchHeadersResult> {
  "use step";

  // Dynamic imports for Node.js modules
  const { getStatusCode } = await import("@readme/http-status-codes");
  const { isExpectedDnsError } = await import("@/lib/dns-utils");
  const { normalizeHeaders } = await import("@/lib/headers-utils");
  const { createLogger } = await import("@/lib/logger/server");
  const { safeFetch } = await import("@/lib/safe-fetch");
  const { isExpectedTlsError } = await import("@/lib/tls-utils");

  const logger = createLogger({ source: "headers-fetch" });
  const allowedHosts = [domain, `www.${domain}`];

  // Inline fetchHttpHeaders logic with dynamic imports
  const result = await (async (): Promise<HeadersFetchInternalResult> => {
    try {
      const final = await safeFetch({
        url: `https://${domain}/`,
        allowHttp: true,
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxRedirects: 5,
        allowedHosts,
        method: "HEAD",
        fallbackToGetOnHeadFailure: true,
        returnOnDisallowedRedirect: true,
      });

      const headers: Header[] = Object.entries(final.headers).map(
        ([name, value]) => ({ name, value }),
      );
      const normalized = normalizeHeaders(headers);

      // Get status message
      let statusMessage: string | undefined;
      try {
        const statusInfo = getStatusCode(final.status);
        statusMessage = statusInfo.message;
      } catch {
        statusMessage = undefined;
      }

      return {
        success: true,
        headers: normalized,
        status: final.status,
        statusMessage,
      };
    } catch (err) {
      const isDnsError = isExpectedDnsError(err);
      const isTlsError = isExpectedTlsError(err);

      if (isDnsError) {
        return {
          success: false,
          error: "dns_error",
          headers: [],
          status: 0,
          statusMessage: undefined,
        };
      }

      if (isTlsError) {
        return {
          success: false,
          error: "tls_error",
          headers: [],
          status: 0,
          statusMessage: "Invalid SSL certificate",
        };
      }

      // Unknown error - return as fetch error (caller can decide to retry)
      logger.warn({ err, domain }, "failed to fetch headers");
      return {
        success: false,
        error: "fetch_error",
        headers: [],
        status: 0,
        statusMessage: undefined,
      };
    }
  })();

  if (!result.success) {
    // fetch_error is retryable, others are permanent
    if (result.error === "fetch_error") {
      throw new RetryableError("Headers fetch failed", { retryAfter: "5s" });
    }
    // TypeScript now narrows error to dns_error | tls_error
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      headers: result.headers,
      status: result.status,
      statusMessage: result.statusMessage,
    },
  };
}

// HTTP header probing can fail due to transient network issues - allow more retries
fetchHeadersStep.maxRetries = 5;
