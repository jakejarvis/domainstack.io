import "server-only";

import { render } from "@react-email/components";
import { differenceInDays } from "date-fns";
import type React from "react";
import { VerificationFailingEmail } from "@/emails/verification-failing";
import { VerificationRevokedEmail } from "@/emails/verification-revoked";
import {
  createNotification,
  hasNotificationBeenSent,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import {
  getVerifiedDomainsForReverification,
  markVerificationFailing,
  markVerificationSuccessful,
  revokeVerification,
  type TrackedDomainForReverification,
} from "@/lib/db/repos/tracked-domains";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import { RESEND_FROM_EMAIL, resend } from "@/lib/resend";
import { verifyDomainOwnership } from "@/server/services/verification";

const logger = createLogger({ source: "reverify-domains" });

// Grace period before revoking verification (in days)
const GRACE_PERIOD_DAYS = 7;

// Result of handling a verification failure
type VerificationFailureAction =
  | "marked_failing"
  | "revoked"
  | "in_grace_period";

/**
 * Check if verification status notifications should be sent for a domain.
 * Checks per-domain override first, then falls back to global user preference.
 */
async function shouldNotifyVerificationStatus(
  domain: TrackedDomainForReverification,
): Promise<boolean> {
  // Check per-domain override first
  if (domain.notificationOverrides.verificationStatus !== undefined) {
    return domain.notificationOverrides.verificationStatus;
  }
  // Fall back to global user preferences
  const globalPrefs = await getOrCreateUserNotificationPreferences(
    domain.userId,
  );
  return globalPrefs.verificationStatus;
}

/**
 * Cron job to re-verify domain ownership for already verified domains.
 * Runs daily at 4:00 AM UTC.
 *
 * Note: Pending domain auto-verification is handled separately by the
 * `auto-verify-pending-domain` function, which runs on a smart retry schedule
 * triggered when a domain is added.
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
  // Run every day at 4:00 AM UTC
  { cron: "0 4 * * *" },
  async ({ step, logger: inngestLogger }) => {
    inngestLogger.info("Starting domain re-verification job");

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
            await markVerificationSuccessful(domain.id);
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

    inngestLogger.info("Domain re-verification job complete", verifiedResults);
    return verifiedResults;
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

    const shouldNotify = await shouldNotifyVerificationStatus(domain);
    if (shouldNotify) {
      await sendVerificationFailingEmail(domain);
    }

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

    if (daysFailing >= GRACE_PERIOD_DAYS) {
      // Grace period exceeded - revoke verification
      await revokeVerification(domain.id);

      const shouldNotify = await shouldNotifyVerificationStatus(domain);
      if (shouldNotify) {
        await sendVerificationRevokedEmail(domain);
      }

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
        daysRemaining: GRACE_PERIOD_DAYS - daysFailing,
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
  if (!resend) {
    logger.warn("Resend not configured, skipping email", {
      domainName: domain.domainName,
    });
    return false;
  }

  // Check if we've already sent this notification
  const alreadySent = await hasNotificationBeenSent(
    domain.id,
    "verification_failing",
  );
  if (alreadySent) {
    return false;
  }

  try {
    const emailHtml = await render(
      VerificationFailingEmail({
        userName: domain.userName.split(" ")[0] || "there",
        domainName: domain.domainName,
        verificationMethod: domain.verificationMethod,
        gracePeriodDays: GRACE_PERIOD_DAYS,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send({
      from: `Domainstack <${RESEND_FROM_EMAIL}>`,
      to: domain.userEmail,
      subject: `⚠️ Verification failing for ${domain.domainName}`,
      html: emailHtml,
    });

    if (error) {
      logger.error("Failed to send verification failing email", error, {
        domainName: domain.domainName,
        userId: domain.userId,
      });
      return false;
    }

    logger.info("Sent verification failing notification", {
      domainName: domain.domainName,
      userId: domain.userId,
      emailId: data?.id,
    });

    await createNotification({
      trackedDomainId: domain.id,
      type: "verification_failing",
    });

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        domain.id,
        "verification_failing",
        data.id,
      );
    }

    return true;
  } catch (err) {
    logger.error("Error sending verification failing email", err, {
      domainName: domain.domainName,
      userId: domain.userId,
    });
    return false;
  }
}

/**
 * Send email when verification is revoked.
 */
async function sendVerificationRevokedEmail(
  domain: TrackedDomainForReverification,
): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", {
      domainName: domain.domainName,
    });
    return false;
  }

  // Check if we've already sent this notification
  const alreadySent = await hasNotificationBeenSent(
    domain.id,
    "verification_revoked",
  );
  if (alreadySent) {
    return false;
  }

  try {
    const emailHtml = await render(
      VerificationRevokedEmail({
        userName: domain.userName.split(" ")[0] || "there",
        domainName: domain.domainName,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send({
      from: `Domainstack <${RESEND_FROM_EMAIL}>`,
      to: domain.userEmail,
      subject: `❌ Verification revoked for ${domain.domainName}`,
      html: emailHtml,
    });

    if (error) {
      logger.error("Failed to send verification revoked email", error, {
        domainName: domain.domainName,
        userId: domain.userId,
      });
      return false;
    }

    logger.info("Sent verification revoked notification", {
      domainName: domain.domainName,
      userId: domain.userId,
      emailId: data?.id,
    });

    await createNotification({
      trackedDomainId: domain.id,
      type: "verification_revoked",
    });

    // Store Resend ID for troubleshooting
    if (data?.id) {
      await updateNotificationResendId(
        domain.id,
        "verification_revoked",
        data.id,
      );
    }

    return true;
  } catch (err) {
    logger.error("Error sending verification revoked email", err, {
      domainName: domain.domainName,
      userId: domain.userId,
    });
    return false;
  }
}
