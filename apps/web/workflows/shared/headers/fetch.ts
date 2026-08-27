/**
 * Headers fetch step.
 *
 * Fetches HTTP headers from a domain.
 * This step is shared between the dedicated headersWorkflow and internal workflows.
 */

import type { FetchHeadersResult } from "./types";

/**
 * Step: Fetch HTTP headers from the domain.
 *
 * DNS, TLS, and unreachable-host errors are returned as typed results so
 * tracking workflows can continue without HTTP data. Unexpected errors still
 * throw and are retried by the workflow SDK.
 *
 * @param domain - The domain to probe
 * @returns FetchHeadersResult with typed error on failure
 */
export async function fetchHeadersStep(domain: string): Promise<FetchHeadersResult> {
  "use step";

  const { HeadersFetchError, fetchHttpHeaders } = await import("@domainstack/server/headers");

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
      // Unreachable host, timeout, connection error: not a tracking failure.
      return { success: false, error: "fetch_error" };
    }
    throw err;
  }
}
