/**
 * Headers fetch step.
 *
 * Fetches HTTP headers from a domain.
 * This step is shared between the dedicated headersWorkflow and internal workflows.
 */

import { RetryableError } from "workflow";
import type { FetchHeadersResult } from "./types";

/**
 * Step: Fetch HTTP headers from the domain.
 *
 * DNS and TLS errors are permanent failures.
 * Transient errors are thrown as RetryableError for automatic retry.
 *
 * @param domain - The domain to probe
 * @returns FetchHeadersResult with typed error on failure
 */
export async function fetchHeadersStep(
  domain: string,
): Promise<FetchHeadersResult> {
  "use step";

  const { HeadersFetchError, fetchHttpHeaders } = await import(
    "@domainstack/server/headers"
  );

  try {
    const result = await fetchHttpHeaders(domain);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (err) {
    if (err instanceof HeadersFetchError) {
      throw new RetryableError("Headers fetch failed", { retryAfter: "5s" });
    }
    throw err;
  }
}

// HTTP header probing can fail due to transient network issues - allow more retries
fetchHeadersStep.maxRetries = 5;
