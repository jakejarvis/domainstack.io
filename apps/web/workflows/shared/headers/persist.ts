import type { HeadersFetchData } from "@domainstack/server/headers";

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

  const { persistHeaders } = await import("@domainstack/server/services/headers");
  try {
    await persistHeaders(domain, fetchData);
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, { context: `persisting headers for ${domain}` });
  }
}
