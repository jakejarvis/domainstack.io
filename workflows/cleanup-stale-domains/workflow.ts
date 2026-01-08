import { subDays } from "date-fns";

export interface CleanupStaleDomainsWorkflowInput {
  staleDomainDays?: number;
}

export interface CleanupStaleDomainsWorkflowResult {
  total: number;
  deleted: number;
  cutoffDate: string;
}

// Domains that remain unverified after this many days will be deleted
const DEFAULT_STALE_DOMAIN_DAYS = 30;

/**
 * Durable workflow to clean up stale unverified domains.
 *
 * Domains that have been added but never verified for more than 30 days
 * are deleted to prevent database bloat and give users a clean slate
 * if they want to re-add the domain later.
 */
export async function cleanupStaleDomainsWorkflow(
  input: CleanupStaleDomainsWorkflowInput = {},
): Promise<CleanupStaleDomainsWorkflowResult> {
  "use workflow";

  const staleDomainDays = input.staleDomainDays ?? DEFAULT_STALE_DOMAIN_DAYS;
  const cutoffDate = subDays(new Date(), staleDomainDays);

  // Step 1: Fetch stale domains
  const staleDomains = await fetchStaleDomains(cutoffDate);

  if (staleDomains.length === 0) {
    return {
      total: 0,
      deleted: 0,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  // Step 2: Delete stale domains
  const deletedCount = await deleteStaleDomains(
    staleDomains.map((d) => d.id),
  );

  return {
    total: staleDomains.length,
    deleted: deletedCount,
    cutoffDate: cutoffDate.toISOString(),
  };
}

async function fetchStaleDomains(
  cutoffDate: Date,
): Promise<{ id: string }[]> {
  "use step";

  const { getStaleUnverifiedDomains } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  return await getStaleUnverifiedDomains(cutoffDate);
}

async function deleteStaleDomains(ids: string[]): Promise<number> {
  "use step";

  const { deleteStaleUnverifiedDomains } = await import(
    "@/lib/db/repos/tracked-domains"
  );

  return await deleteStaleUnverifiedDomains(ids);
}
