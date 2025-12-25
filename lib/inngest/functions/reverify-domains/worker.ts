import "server-only";

import { differenceInDays } from "date-fns";
import type { Logger } from "inngest";
import { VerificationFailingEmail } from "@/emails/verification-failing";
import { VerificationRevokedEmail } from "@/emails/verification-revoked";
import { VERIFICATION_GRACE_PERIOD_DAYS } from "@/lib/constants/verification";
import {
  createNotification,
  hasRecentNotification,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import {
  findTrackedDomainWithDomainName,
  getTrackedDomainForReverification,
  markVerificationFailing,
  markVerificationSuccessful,
  revokeVerification,
  type TrackedDomainForReverification,
  verifyTrackedDomain,
} from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { generateIdempotencyKey } from "@/lib/notifications";
import { sendPrettyEmail } from "@/lib/resend";
import {
  tryAllVerificationMethods,
  verifyDomainOwnership,
} from "@/server/services/verification";

type VerificationFailureAction =
  | "marked_failing"
  | "revoked"
  | "in_grace_period";

/**
 * Worker to verify a single pending domain.
 */
export const verifyPendingDomainCronWorker = inngest.createFunction(
  {
    id: "verify-pending-domain-cron-worker",
    retries: 3,
    concurrency: {
      limit: 5,
    },
  },
  { event: INNGEST_EVENTS.VERIFY_PENDING_CRON },
  async ({ event, step, logger: inngestLogger }) => {
    const { trackedDomainId } = event.data;

    const domain = await step.run("fetch-domain", async () => {
      return await findTrackedDomainWithDomainName(trackedDomainId);
    });

    if (!domain) {
      inngestLogger.warn("Domain not found, skipping", { trackedDomainId });
      return { skipped: true, reason: "not_found" };
    }

    if (domain.verified) {
      inngestLogger.info("Domain already verified, skipping", {
        trackedDomainId,
      });
      return { skipped: true, reason: "already_verified" };
    }

    try {
      const result = await step.run("verify-ownership", async () => {
        return await tryAllVerificationMethods(
          domain.domainName,
          domain.verificationToken,
        );
      });

      if (result.verified && result.method) {
        const verifiedMethod = result.method;
        await step.run("mark-verified", async () => {
          return await verifyTrackedDomain(trackedDomainId, verifiedMethod);
        });
        inngestLogger.info("Domain verified successfully", { trackedDomainId });
        return { verified: true, method: verifiedMethod };
      }

      return { verified: false };
    } catch (err) {
      inngestLogger.error("Error verifying pending domain", err, {
        trackedDomainId,
      });
      throw err;
    }
  },
);

/**
 * Worker to re-verify a single verified domain.
 */
export const reverifyOwnershipWorker = inngest.createFunction(
  {
    id: "reverify-ownership-worker",
    retries: 3,
    concurrency: {
      limit: 5,
    },
  },
  { event: INNGEST_EVENTS.REVERIFY_OWNERSHIP },
  async ({ event, step, logger: inngestLogger }) => {
    const { trackedDomainId } = event.data;

    const domain = await step.run("fetch-domain", async () => {
      return await getTrackedDomainForReverification(trackedDomainId);
    });

    if (!domain) {
      inngestLogger.warn("Domain not found or missing method, skipping", {
        trackedDomainId,
      });
      return { skipped: true, reason: "invalid_state" };
    }

    try {
      const result = await step.run("check-ownership", async () => {
        return await verifyDomainOwnership(
          domain.domainName,
          domain.verificationToken,
          domain.verificationMethod,
        );
      });

      if (result.verified) {
        await step.run("mark-success", async () => {
          return await markVerificationSuccessful(trackedDomainId);
        });
        return { verified: true };
      } else {
        // Handle failure
        const domainWithDate = {
          ...domain,
          verificationFailedAt: domain.verificationFailedAt
            ? new Date(domain.verificationFailedAt)
            : null,
        };

        const action = await step.run("handle-failure", async () => {
          return await handleVerificationFailure(domainWithDate, inngestLogger);
        });

        return { verified: false, action };
      }
    } catch (err) {
      inngestLogger.error("Error re-verifying domain", err, {
        trackedDomainId,
      });
      throw err;
    }
  },
);

// --- Helper Functions (copied from original) ---

async function handleVerificationFailure(
  domain: TrackedDomainForReverification,
  logger: Logger,
): Promise<VerificationFailureAction> {
  const now = new Date();

  if (domain.verificationStatus === "verified") {
    // First failure - mark as failing and send warning
    await markVerificationFailing(domain.id);
    await sendVerificationFailingEmail(domain, logger);

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
      await sendVerificationRevokedEmail(domain, logger);

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

  return "in_grace_period";
}

async function sendVerificationFailingEmail(
  domain: TrackedDomainForReverification,
  logger: Logger,
): Promise<boolean> {
  const alreadySent = await hasRecentNotification(
    domain.id,
    "verification_failing",
  );
  if (alreadySent) return false;

  const idempotencyKey = generateIdempotencyKey(
    domain.id,
    "verification_failing",
  );

  const title = `Verification failing for ${domain.domainName}`;
  const subject = `⚠️ ${title}`;
  const message = `Verification for ${domain.domainName} is failing. You have ${VERIFICATION_GRACE_PERIOD_DAYS} days to fix it before access is revoked.`;

  try {
    // Create in-app notification first
    const notification = await createNotification({
      userId: domain.userId,
      trackedDomainId: domain.id,
      type: "verification_failing",
      title,
      message,
      data: { domainName: domain.domainName },
    });

    if (!notification) {
      logger.error("Failed to create notification record", {
        trackedDomainId: domain.id,
        notificationType: "verification_failing",
        domainName: domain.domainName,
      });
      throw new Error("Failed to create notification record in database");
    }

    // Send email notification
    const { data, error } = await sendPrettyEmail(
      {
        to: domain.userEmail,
        subject,
        react: VerificationFailingEmail({
          userName: domain.userName.split(" ")[0] || "there",
          domainName: domain.domainName,
          verificationMethod: domain.verificationMethod,
          gracePeriodDays: VERIFICATION_GRACE_PERIOD_DAYS,
        }),
      },
      { idempotencyKey },
    );

    if (error) throw new Error(`Resend error: ${error.message}`);

    // Update notification with email ID
    if (data?.id) {
      await updateNotificationResendId(notification.id, data.id);
    }

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

async function sendVerificationRevokedEmail(
  domain: TrackedDomainForReverification,
  logger: Logger,
): Promise<boolean> {
  const alreadySent = await hasRecentNotification(
    domain.id,
    "verification_revoked",
  );
  if (alreadySent) return false;

  const idempotencyKey = generateIdempotencyKey(
    domain.id,
    "verification_revoked",
  );

  const title = `Verification revoked for ${domain.domainName}`;
  const subject = `❌ ${title}`;
  const message = `Verification for ${domain.domainName} has been revoked. The grace period has expired without successful re-verification.`;

  try {
    // Create in-app notification first
    const notification = await createNotification({
      userId: domain.userId,
      trackedDomainId: domain.id,
      type: "verification_revoked",
      title,
      message,
      data: { domainName: domain.domainName },
    });

    if (!notification) {
      logger.error("Failed to create notification record", {
        trackedDomainId: domain.id,
        notificationType: "verification_revoked",
        domainName: domain.domainName,
      });
      throw new Error("Failed to create notification record in database");
    }

    // Send email notification
    const { data, error } = await sendPrettyEmail(
      {
        to: domain.userEmail,
        subject,
        react: VerificationRevokedEmail({
          userName: domain.userName.split(" ")[0] || "there",
          domainName: domain.domainName,
        }),
      },
      { idempotencyKey },
    );

    if (error) throw new Error(`Resend error: ${error.message}`);

    // Update notification with email ID
    if (data?.id) {
      await updateNotificationResendId(notification.id, data.id);
    }

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
