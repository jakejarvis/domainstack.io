import "server-only";

import {
  findTrackedDomainWithDomainName,
  verifyTrackedDomain,
} from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { tryAllVerificationMethods } from "@/server/services/verification";

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
 *
 * Retries: Set to 0 because the manual retry loop handles expected failures
 * (DNS propagation delays). Inngest retries are for unhandled errors only,
 * and the daily cron provides a robust fallback for infrastructure issues.
 */
export const autoVerifyPendingDomain = inngest.createFunction(
  {
    id: "auto-verify-pending-domain",
    retries: 0,
    // Prevent multiple verification attempts for the same domain
    concurrency: {
      limit: 1,
      key: "event.data.trackedDomainId",
    },
  },
  { event: INNGEST_EVENTS.AUTO_VERIFY_PENDING_DOMAIN },
  async ({ event, step, logger: inngestLogger }) => {
    const { trackedDomainId, domainName } = event.data;

    inngestLogger.info("Starting auto-verification schedule", {
      trackedDomainId,
      domainName,
    });

    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      const delay = RETRY_DELAYS[attempt];

      // Wait before checking (gives DNS time to propagate)
      await step.sleep(`wait-${attempt}`, delay);

      // Check if the domain is still pending and fetch latest verification inputs
      // This ensures we use current domainName/token even if they changed after the event was queued
      const tracked = await step.run(`check-status-${attempt}`, async () => {
        const domain = await findTrackedDomainWithDomainName(trackedDomainId);
        if (!domain) {
          return { status: "deleted" as const };
        }
        // If already verified, no need to continue
        if (domain.verified) {
          return {
            status: "already-verified" as const,
            domainName: domain.domainName,
          };
        }
        return {
          status: "pending" as const,
          domainName: domain.domainName,
          verificationToken: domain.verificationToken,
        };
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
          domainName: tracked.domainName,
        });
        return { result: "cancelled", reason: "already_verified" };
      }

      // Attempt verification using fresh values from DB
      const { domainName: currentDomainName, verificationToken: currentToken } =
        tracked;

      // Defensive check: skip if token is missing (shouldn't happen for pending domains)
      if (!currentToken) {
        inngestLogger.warn(
          "Skipping auto-verification: missing verification token",
          {
            trackedDomainId,
            domainName: currentDomainName,
            attempt: attempt + 1,
          },
        );
        continue;
      }

      const result = await step.run(`verify-attempt-${attempt}`, async () => {
        return await tryAllVerificationMethods(currentDomainName, currentToken);
      });

      if (result.verified && result.method) {
        // Success! Mark the domain as verified
        const verifiedMethod = result.method;
        await step.run(`mark-verified-${attempt}`, async () => {
          return await verifyTrackedDomain(trackedDomainId, verifiedMethod);
        });

        inngestLogger.info("Auto-verified pending domain", {
          trackedDomainId,
          domainName: currentDomainName,
          method: result.method,
          attempt: attempt + 1,
        });

        return {
          result: "verified",
          domainName: currentDomainName,
          verifiedMethod: result.method,
          attempt: attempt + 1,
        };
      } else {
        inngestLogger.debug("Verification attempt failed, will retry", {
          domainName: currentDomainName,
          verifiedMethod: result.method,
          attempt: attempt + 1,
          nextDelay: RETRY_DELAYS[attempt + 1] ?? "none (final attempt)",
        });
      }
    }

    // All attempts exhausted - daily cron will catch it
    inngestLogger.info("Auto-verification schedule exhausted", {
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
