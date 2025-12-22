import "server-only";

import { differenceInDays } from "date-fns";
import { VerificationFailingEmail } from "@/emails/verification-failing";
import { VerificationRevokedEmail } from "@/emails/verification-revoked";
import { VERIFICATION_GRACE_PERIOD_DAYS } from "@/lib/constants/verification";
import {
  createNotification,
  hasNotificationBeenSent,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import {
  getPendingDomainsForAutoVerification,
  getVerifiedDomainsForReverification,
  markVerificationFailing,
  markVerificationSuccessful,
  revokeVerification,
  type TrackedDomainForReverification,
  verifyTrackedDomain,
} from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import { generateIdempotencyKey } from "@/lib/notifications";
import { sendPrettyEmail } from "@/lib/resend";
import {
  tryAllVerificationMethods,
  verifyDomainOwnership,
} from "@/server/services/verification";

const logger = createLogger({ source: "reverify-domains" });

// Result of handling a verification failure
type VerificationFailureAction =
  | "marked_failing"
  | "revoked"
  | "in_grace_period";

/**
 * Cron job to verify domain ownership.
 * Runs daily at 4:00 AM and 4:00 PM UTC.
 *
 * This job handles two types of verification:
 * 1. Re-verifying already verified domains (to catch if verification is removed)
 * 2. Auto-verifying pending domains that may have been verified since the initial add
 *
 * Note: Initial pending domain auto-verification is handled by the
 * `auto-verify-pending-domain` function, which runs on a smart retry schedule
 * triggered when a domain is added. This cron job acts as a safety net for
 * domains that take longer than ~2 hours to propagate.
 *
 * Grace period workflow for verified domains:
 * - Day 0: Verification fails → mark as 'failing', send warning email
 * - Day 7: Still failing → revoke verification, send final email
 */
export const reverifyDomains = inngest.createFunction(
  {
    id: "reverify-domains",
    retries: 3,
    // Run only one instance at a time
    concurrency: {
      limit: 1,
    },
  },
  // Run every day at 4:00 AM and 4:00 PM UTC
  { cron: "0 4,16 * * *" },
  async ({ step, logger: inngestLogger }) => {
    inngestLogger.info("Starting domain verification job");

    // 1. Process Pending Domains
    const pendingDomains = await step.run("fetch-pending-domains", async () => {
      return await getPendingDomainsForAutoVerification();
    });

    inngestLogger.info(
      `Found ${pendingDomains.length} pending domains to verify`,
    );

    const pendingResults = {
      total: pendingDomains.length,
      verified: 0,
      stillPending: 0,
      errors: 0,
    };

    for (const domain of pendingDomains) {
      try {
        const result = await step.run(
          `verify-pending-${domain.id}`,
          async () => {
            return await tryAllVerificationMethods(
              domain.domainName,
              domain.verificationToken,
            );
          },
        );

        if (result.verified && result.method) {
          const method = result.method;
          await step.run(`mark-pending-verified-${domain.id}`, async () => {
            return await verifyTrackedDomain(domain.id, method);
          });
          pendingResults.verified++;

          inngestLogger.info("Auto-verified pending domain during cron", {
            domainId: domain.id,
            domainName: domain.domainName,
            method: result.method,
          });
        } else {
          pendingResults.stillPending++;
        }
      } catch (err) {
        logger.error("Error verifying pending domain", err, {
          domainId: domain.id,
          domainName: domain.domainName,
        });
        pendingResults.errors++;
      }
    }

    inngestLogger.info("Pending domain verification complete", pendingResults);

    // 2. Process Verified Domains (Re-verification)
    const verifiedDomains = await step.run(
      "fetch-verified-domains",
      async () => {
        return await getVerifiedDomainsForReverification();
      },
    );

    inngestLogger.info(
      `Found ${verifiedDomains.length} verified domains to re-verify`,
    );

    const verifiedResults = {
      total: verifiedDomains.length,
      verified: 0,
      failing: 0,
      revoked: 0,
      errors: 0,
    };

    for (const domain of verifiedDomains) {
      try {
        const result = await step.run(`reverify-${domain.id}`, async () => {
          return await verifyDomainOwnership(
            domain.domainName,
            domain.verificationToken,
            domain.verificationMethod,
          );
        });

        if (result.verified) {
          // Verification successful
          await step.run(`mark-verified-${domain.id}`, async () => {
            return await markVerificationSuccessful(domain.id);
          });
          verifiedResults.verified++;
        } else {
          // Verification failed - convert serialized date back to Date
          const domainWithDate = {
            ...domain,
            verificationFailedAt: domain.verificationFailedAt
              ? new Date(domain.verificationFailedAt)
              : null,
          };
          const action = await step.run(
            `handle-failure-${domain.id}`,
            async () => {
              return await handleVerificationFailure(domainWithDate);
            },
          );

          // Increment the correct counter based on the action taken
          if (action === "revoked") {
            verifiedResults.revoked++;
          } else {
            // "marked_failing" or "in_grace_period"
            verifiedResults.failing++;
          }
        }
      } catch (err) {
        logger.error("Error re-verifying domain", err, {
          domainId: domain.id,
          domainName: domain.domainName,
        });
        verifiedResults.errors++;
      }
    }

    inngestLogger.info("Domain re-verification job complete", {
      pending: pendingResults,
      verified: verifiedResults,
    });
    return { pending: pendingResults, verified: verifiedResults };
  },
);

/**
 * Handle a verification failure.
 * If within grace period, mark as failing and send warning.
 * If grace period exceeded, revoke verification.
 *
 * @returns The action taken: "marked_failing", "revoked", or "in_grace_period"
 */
async function handleVerificationFailure(
  domain: TrackedDomainForReverification,
): Promise<VerificationFailureAction> {
  const now = new Date();

  if (domain.verificationStatus === "verified") {
    // First failure - mark as failing and send warning
    await markVerificationFailing(domain.id);
    await sendVerificationFailingEmail(domain);

    logger.info("Marked domain as failing verification", {
      domainId: domain.id,
      domainName: domain.domainName,
    });

    return "marked_failing";
  } else if (domain.verificationStatus === "failing") {
    // Already failing - check if grace period exceeded
    const failedAt = domain.verificationFailedAt;
    if (!failedAt) {
      // Shouldn't happen, but mark failing time now
      await markVerificationFailing(domain.id);
      return "marked_failing";
    }

    const daysFailing = differenceInDays(now, failedAt);

    if (daysFailing >= VERIFICATION_GRACE_PERIOD_DAYS) {
      // Grace period exceeded - revoke verification
      await revokeVerification(domain.id);
      await sendVerificationRevokedEmail(domain);

      logger.info("Revoked domain verification after grace period", {
        domainId: domain.id,
        domainName: domain.domainName,
        daysFailing,
      });

      return "revoked";
    } else {
      logger.debug("Domain still in grace period", {
        domainId: domain.id,
        domainName: domain.domainName,
        daysFailing,
        daysRemaining: VERIFICATION_GRACE_PERIOD_DAYS - daysFailing,
      });

      return "in_grace_period";
    }
  }

  // Shouldn't reach here, but default to in_grace_period
  return "in_grace_period";
}

/**
 * Send email when verification first starts failing.
 */
async function sendVerificationFailingEmail(
  domain: TrackedDomainForReverification,
): Promise<boolean> {
  // Check if we've already sent this notification
  const alreadySent = await hasNotificationBeenSent(
    domain.id,
    "verification_failing",
  );
  if (alreadySent) {
    return false;
  }

  const idempotencyKey = generateIdempotencyKey(
    domain.id,
    "verification_failing",
  );

  try {
    // Create notification record first for idempotency
    await createNotification({
      trackedDomainId: domain.id,
      type: "verification_failing",
    });

    const { data, error } = await sendPrettyEmail(
      {
        to: domain.userEmail,
        subject: `⚠️ Verification failing for ${domain.domainName}`,
        react: VerificationFailingEmail({
          userName: domain.userName.split(" ")[0] || "there",
          domainName: domain.domainName,
          verificationMethod: domain.verificationMethod,
          gracePeriodDays: VERIFICATION_GRACE_PERIOD_DAYS,
        }),
      },
      { idempotencyKey },
    );

    if (error) {
      logger.error("Failed to send verification failing email", error, {
        domainName: domain.domainName,
        userId: domain.userId,
        idempotencyKey,
      });
      throw new Error(`Resend error: ${error.message}`);
    }

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        domain.id,
        "verification_failing",
        data.id,
      );
    }

    logger.info("Sent verification failing notification", {
      domainName: domain.domainName,
      userId: domain.userId,
      emailId: data?.id,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending verification failing email", err, {
      domainName: domain.domainName,
      userId: domain.userId,
      idempotencyKey,
    });
    throw err;
  }
}

/**
 * Send email when verification is revoked.
 */
async function sendVerificationRevokedEmail(
  domain: TrackedDomainForReverification,
): Promise<boolean> {
  // Check if we've already sent this notification
  const alreadySent = await hasNotificationBeenSent(
    domain.id,
    "verification_revoked",
  );
  if (alreadySent) {
    return false;
  }

  const idempotencyKey = generateIdempotencyKey(
    domain.id,
    "verification_revoked",
  );

  try {
    // Create notification record first for idempotency
    await createNotification({
      trackedDomainId: domain.id,
      type: "verification_revoked",
    });

    const { data, error } = await sendPrettyEmail(
      {
        to: domain.userEmail,
        subject: `❌ Verification revoked for ${domain.domainName}`,
        react: VerificationRevokedEmail({
          userName: domain.userName.split(" ")[0] || "there",
          domainName: domain.domainName,
        }),
      },
      { idempotencyKey },
    );

    if (error) {
      logger.error("Failed to send verification revoked email", error, {
        domainName: domain.domainName,
        userId: domain.userId,
        idempotencyKey,
      });
      throw new Error(`Resend error: ${error.message}`);
    }

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        domain.id,
        "verification_revoked",
        data.id,
      );
    }

    logger.info("Sent verification revoked notification", {
      domainName: domain.domainName,
      userId: domain.userId,
      emailId: data?.id,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending verification revoked email", err, {
      domainName: domain.domainName,
      userId: domain.userId,
      idempotencyKey,
    });
    throw err;
  }
}
