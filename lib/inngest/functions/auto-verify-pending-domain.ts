import "server-only";

import { z } from "zod";
import {
  findTrackedDomainById,
  verifyTrackedDomain,
} from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import { tryAllVerificationMethods } from "@/server/services/verification";

const logger = createLogger({ source: "auto-verify-pending-domain" });

/**
 * Event schema for triggering auto-verification of a pending domain.
 */
const eventSchema = z.object({
  trackedDomainId: z.string().uuid(),
  domainName: z.string().min(1),
  verificationToken: z.string().min(1),
});

export type AutoVerifyPendingDomainEvent = z.infer<typeof eventSchema>;

/**
 * Retry schedule for auto-verification attempts.
 * Front-loads checks when DNS propagation is most likely to have completed.
 *
 * Schedule: 1min → 3min → 10min → 30min → 1hr (then stop)
 * Total time covered: ~2 hours
 *
 * After this, the daily cron job will catch any stragglers.
 */
const RETRY_DELAYS = [
  "1m", // First check after 1 minute (most DNS providers propagate quickly)
  "3m", // Second check at 4 minutes total
  "10m", // Third check at 14 minutes total
  "30m", // Fourth check at 44 minutes total
  "1h", // Final check at ~1 hour 44 minutes total
] as const;

/**
 * Scheduled task to auto-verify a pending domain.
 * Triggered when a user adds a domain to track.
 *
 * Uses step.sleep() to implement a smart retry schedule that:
 * - Checks frequently at first (when verification is most likely to succeed)
 * - Backs off over time to avoid unnecessary checks
 * - Stops after ~2 hours (daily cron catches stragglers)
 */
export const autoVerifyPendingDomain = inngest.createFunction(
  {
    id: "auto-verify-pending-domain",
    retries: 2,
    // Prevent multiple verification attempts for the same domain
    concurrency: {
      limit: 1,
      key: "event.data.trackedDomainId",
    },
  },
  { event: "tracked-domain/verify-pending" },
  async ({ event, step, logger: inngestLogger }) => {
    const { trackedDomainId, domainName, verificationToken } =
      eventSchema.parse(event.data);

    inngestLogger.info("Starting auto-verification schedule", {
      trackedDomainId,
      domainName,
    });

    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      const delay = RETRY_DELAYS[attempt];

      // Wait before checking (gives DNS time to propagate)
      await step.sleep(`wait-${attempt}`, delay);

      // Check if the domain is still pending before attempting verification
      // A domain is "pending" when verified=false (verificationStatus will be "unverified")
      const tracked = await step.run(`check-status-${attempt}`, async () => {
        const domain = await findTrackedDomainById(trackedDomainId);
        if (!domain) {
          return { status: "deleted" as const };
        }
        // If already verified, no need to continue
        if (domain.verified) {
          return { status: "already-verified" as const };
        }
        return { status: "pending" as const };
      });

      // If domain was deleted or already verified, stop the schedule
      if (tracked.status === "deleted") {
        inngestLogger.info("Domain was deleted, stopping verification", {
          trackedDomainId,
          domainName,
        });
        return { result: "cancelled", reason: "domain_deleted" };
      }

      if (tracked.status === "already-verified") {
        inngestLogger.info("Domain already verified, stopping schedule", {
          trackedDomainId,
          domainName,
        });
        return { result: "cancelled", reason: "already_verified" };
      }

      // Attempt verification
      const result = await step.run(`verify-attempt-${attempt}`, async () => {
        return await tryAllVerificationMethods(domainName, verificationToken);
      });

      if (result.verified && result.method) {
        // Success! Mark the domain as verified
        const verifiedMethod = result.method;
        await step.run(`mark-verified-${attempt}`, async () => {
          await verifyTrackedDomain(trackedDomainId, verifiedMethod);
        });

        logger.info("Auto-verified pending domain", {
          trackedDomainId,
          domainName,
          method: result.method,
          attempt: attempt + 1,
        });

        return {
          result: "verified",
          method: result.method,
          attempt: attempt + 1,
        };
      }

      inngestLogger.debug("Verification attempt failed, will retry", {
        trackedDomainId,
        domainName,
        attempt: attempt + 1,
        nextDelay: RETRY_DELAYS[attempt + 1] ?? "none (final attempt)",
      });
    }

    // All attempts exhausted - daily cron will catch it
    logger.info("Auto-verification schedule exhausted", {
      trackedDomainId,
      domainName,
      totalAttempts: RETRY_DELAYS.length,
    });

    return {
      result: "exhausted",
      message: "Verification schedule complete. Daily cron will retry.",
    };
  },
);
