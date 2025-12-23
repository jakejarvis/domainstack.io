import "server-only";

import { subDays } from "date-fns";
import {
  deleteStaleUnverifiedDomains,
  getStaleUnverifiedDomains,
} from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";

// Domains that remain unverified after this many days will be deleted
const STALE_DOMAIN_DAYS = 30;

/**
 * Cron job to clean up stale unverified domains.
 * Runs weekly on Sundays at 3:00 AM UTC.
 *
 * Domains that have been added but never verified for more than 30 days
 * are deleted to prevent database bloat and give users a clean slate
 * if they want to re-add the domain later.
 */
export const cleanupStaleDomains = inngest.createFunction(
  {
    id: "domain/cleanup",
    retries: 3,
    concurrency: {
      limit: 1,
    },
  },
  // Run every Sunday at 3:00 AM UTC
  { cron: "0 3 * * 0" },
  async ({ step, logger: inngestLogger }) => {
    inngestLogger.info("Starting stale domain cleanup");

    // Calculate cutoff date (domains created before this are considered stale)
    const cutoffDate = subDays(new Date(), STALE_DOMAIN_DAYS);

    // Get all stale unverified domains
    const staleDomains = await step.run("fetch-stale-domains", async () => {
      return await getStaleUnverifiedDomains(cutoffDate);
    });

    inngestLogger.info(`Found ${staleDomains.length} stale unverified domains`);

    if (staleDomains.length === 0) {
      return {
        total: 0,
        deleted: 0,
        cutoffDate: cutoffDate.toISOString(),
      };
    }

    // Log details for debugging
    for (const domain of staleDomains) {
      inngestLogger.debug("stale domain found", {
        trackedDomainId: domain.id,
        userId: domain.userId,
        domainName: domain.domainName,
        createdAt: new Date(domain.createdAt).toISOString(),
      });
    }

    // Delete all stale domains in one batch
    const deletedCount = await step.run("delete-stale-domains", async () => {
      const ids = staleDomains.map((d) => d.id);
      return await deleteStaleUnverifiedDomains(ids);
    });

    inngestLogger.info("Stale domain cleanup complete", {
      total: staleDomains.length,
      deleted: deletedCount,
    });

    return {
      total: staleDomains.length,
      deleted: deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    };
  },
);
