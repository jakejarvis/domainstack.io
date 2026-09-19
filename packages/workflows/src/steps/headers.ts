import type {
  HeadersFetchData,
  HeadersFetchResult as ServerHeadersFetchResult,
} from "@domainstack/core/headers";

type FetchHeadersResult = ServerHeadersFetchResult | { success: false; error: "fetch_error" };

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

  const { HeadersFetchError, fetchHttpHeaders } = await import("@domainstack/core/headers");

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

/**
 * Step: Persist headers to database.
 *
 * @param domain - The domain name
 * @param fetchData - The headers fetch result
 */
export async function persistHeadersStep(
  domain: string,
  fetchData: HeadersFetchData,
): Promise<void> {
  "use step";

  const { persistHeaders } = await import("@domainstack/core/headers");
  try {
    await persistHeaders(domain, fetchData);
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, { context: `persisting headers for ${domain}` });
  }
}
