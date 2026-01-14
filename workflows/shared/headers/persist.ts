/**
 * Headers persist step.
 *
 * Persists HTTP headers to the database.
 * This step is shared between the dedicated headersWorkflow and internal workflows.
 *
 * Note: This step only handles database persistence. Revalidation scheduling
 * should be done at the workflow level using scheduleRevalidationBatchStep.
 */

import type { HeadersFetchData } from "./types";

/** Result from persist step, includes lastAccessedAt for scheduling */
export interface PersistResult {
  lastAccessedAt: Date | null;
}

/**
 * Step: Persist headers to database.
 *
 * Creates domain record if needed. Returns lastAccessedAt for use in
 * scheduling revalidation at the workflow level.
 *
 * @param domain - The domain name
 * @param fetchData - The headers fetch result
 * @returns Object with lastAccessedAt for scheduling
 */
export async function persistHeadersStep(
  domain: string,
  fetchData: HeadersFetchData,
): Promise<PersistResult> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { getStepMetadata } = await import("workflow");
  const { createLogger } = await import("@/lib/logger/server");
  const { ttlForHeaders } = await import("@/lib/ttl");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceHeaders } = await import("@/lib/db/repos/headers");

  const { stepId } = getStepMetadata();
  const logger = createLogger({ source: "headers-persist" });
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

    logger.debug({ domain, stepId }, "headers persisted");

    return { lastAccessedAt: domainRecord.lastAccessedAt ?? null };
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting headers for ${domain}`,
    });
  }
}
