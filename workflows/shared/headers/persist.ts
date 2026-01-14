/**
 * Headers persist step.
 *
 * Persists HTTP headers to the database.
 * This step is shared between the dedicated headersWorkflow and internal workflows.
 */

import type { HeadersFetchData } from "./types";

/**
 * Step: Persist headers to database.
 *
 * Creates domain record if needed and schedules revalidation.
 *
 * @param domain - The domain name
 * @param fetchData - The headers fetch result
 */
export async function persistHeadersStep(
  domain: string,
  fetchData: HeadersFetchData,
): Promise<void> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { ttlForHeaders } = await import("@/lib/ttl");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceHeaders } = await import("@/lib/db/repos/headers");
  const { scheduleRevalidation } = await import("@/lib/revalidation");

  const now = new Date();
  const expiresAt = ttlForHeaders(now);

  try {
    // Ensure domain record exists (creates if needed)
    const domainRecord = await ensureDomainRecord(domain);

    await replaceHeaders({
      domainId: domainRecord.id,
      headers: fetchData.headers,
      status: fetchData.status,
      fetchedAt: now,
      expiresAt,
    });

    // Schedule background revalidation
    await scheduleRevalidation(
      domain,
      "headers",
      expiresAt.getTime(),
      domainRecord.lastAccessedAt ?? null,
    );
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting headers for ${domain}`,
    });
  }
}
