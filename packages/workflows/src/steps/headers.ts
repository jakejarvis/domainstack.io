import type { HeadersFetchData, HeadersFetchResult } from "@domainstack/core/headers/types";

/**
 * Step: Fetch HTTP headers from the domain.
 *
 * DNS and TLS errors are returned as typed results so tracking workflows can
 * continue without HTTP data. Everything else (HeadersFetchError included)
 * is treated as transient and throws so the workflow SDK retries it.
 *
 * @param domain - The domain to probe
 * @returns HeadersFetchResult with typed error on failure
 */
export async function fetchHeadersStep(domain: string): Promise<HeadersFetchResult> {
  "use step";

  const { fetchHttpHeaders } = await import("@domainstack/core/headers/fetch");

  const result = await fetchHttpHeaders(domain);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: result.data,
  };
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
